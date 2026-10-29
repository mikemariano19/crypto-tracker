"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, RotateCw } from "lucide-react";

import GlobalSentimentHeader from "@/components/news/GlobalSentimentHeader";
import NewsFilterBar, { COIN_FILTERS } from "@/components/news/NewsFilterBar";
import NewsStoryCard from "@/components/news/NewsStoryCard";
import TopStoryCard from "@/components/news/TopStoryCard";
import SentimentByAssetList from "@/components/news/SentimentByAssetList";
import SentimentTrendChart from "@/components/news/SentimentTrendChart";
import TrendingTags from "@/components/news/TrendingTags";
import NewStoriesPill from "@/components/news/NewStoriesPill";
import NewsSkeleton, { HeaderSkeleton, StoryCardSkeleton } from "@/components/news/NewsSkeleton";
import EmptyState from "@/components/news/EmptyState";
import AiDisclaimer from "@/components/news/AiDisclaimer";
import SentimentBadge from "@/components/news/SentimentBadge";
import SentimentSplitBar from "@/components/news/SentimentSplitBar";
import { useGlobalSentiment } from "@/hooks/useGlobalSentiment";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import { useSentimentTrend } from "@/hooks/useSentimentTrend";
import { useNewsRealtime } from "@/hooks/useNewsRealtime";
import { useNow } from "@/hooks/useNow";
import { formatClockTime, formatSignedPct } from "@/lib/formatNews";
import type { Level, NewsFilters, NewsRange, NewsSort, NewsStory, SentimentLabel } from "@/types/news";

const DEFAULT_FILTERS: NewsFilters = {
  label: null,
  asset: null,
  impact: null,
  range: "3d",
  sort: "latest",
};

const IMPACT_RANK: Record<Level, number> = { low: 1, medium: 2, high: 3 };

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function parseFilters(params: URLSearchParams): NewsFilters {
  return {
    label: oneOf<SentimentLabel>(params.get("label"), ["bullish", "bearish", "neutral"]),
    asset: oneOf(params.get("asset")?.toUpperCase() ?? null, COIN_FILTERS),
    impact: oneOf<Level>(params.get("impact"), ["low", "medium", "high"]),
    range: oneOf<NewsRange>(params.get("range"), ["6h", "24h", "3d"]) ?? DEFAULT_FILTERS.range,
    sort: oneOf<NewsSort>(params.get("sort"), ["latest", "impact"]) ?? DEFAULT_FILTERS.sort,
  };
}

/**
 * Filters live in the URL (defaults left out) so any view can be shared.
 */
function filtersToSearch(filters: NewsFilters): string {
  const params = new URLSearchParams();

  if (filters.label) params.set("label", filters.label);
  if (filters.asset) params.set("asset", filters.asset);
  if (filters.impact) params.set("impact", filters.impact);
  if (filters.range !== DEFAULT_FILTERS.range) params.set("range", filters.range);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);

  const search = params.toString();
  return search ? `?${search}` : "";
}

/**
 * The highest-impact, most relevant story leads the page; with "Sort:
 * Impact" that's simply the first one.
 */
function pickTopStory(stories: NewsStory[], sort: NewsSort): NewsStory | null {
  if (stories.length === 0) return null;
  if (sort === "impact") return stories[0];

  // Impact first; then prefer stories that fill the Google-News-style lead
  // (an image, other outlets covering it, AI analysis); then relevance.
  const score = (story: NewsStory) =>
    IMPACT_RANK[story.impact] * 1_000 +
    (story.related.length > 0 ? 200 : 0) +
    (story.imageUrl ? 150 : 0) +
    (story.analyzed ? 100 : 0) +
    story.relevance;

  return stories.reduce((best, story) => (score(story) > score(best) ? story : best));
}

export default function NewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFilters(new URLSearchParams(searchParams.toString()));
  const hasFilters = filtersToSearch({ ...filters, range: DEFAULT_FILTERS.range, sort: DEFAULT_FILTERS.sort }) !== "";

  const now = useNow();
  const global = useGlobalSentiment();
  const trend = useSentimentTrend(7);
  const feed = useNewsFeed(filters);
  const { newCount, clearNewCount } = useNewsRealtime();

  const topRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerOutOfView, setHeaderOutOfView] = useState(false);
  const hasSnapshot = global.snapshot !== null;

  // Compact sentiment bar once the full header scrolls away.
  useEffect(() => {
    const element = headerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHeaderOutOfView(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-56px 0px 0px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasSnapshot]);

  const setFilters = (changes: Partial<NewsFilters>) => {
    router.replace(`/news${filtersToSearch({ ...filters, ...changes })}`, { scroll: false });
  };

  const showNewStories = async () => {
    clearNewCount();
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    await feed.reload();
  };

  const showAsset = (asset: string | null) => {
    setFilters({ asset });
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const topStory = pickTopStory(feed.stories, filters.sort);
  const restStories = feed.stories.filter((story) => story !== topStory);
  const snapshot = global.snapshot;
  const hasAnyData = snapshot !== null || feed.stories.length > 0;
  const refreshFailed = (feed.isError || global.isError) && hasAnyData;

  let feedBody: React.ReactNode;

  if (feed.isLoading && feed.stories.length === 0) {
    feedBody = <NewsSkeleton withHeader={false} />;
  } else if (feed.stories.length === 0 && feed.isError) {
    feedBody = (
      <EmptyState
        title="Couldn't load news"
        description="The news service didn't respond. Retrying automatically."
        actionLabel="Retry now"
        onAction={() => feed.reload()}
      />
    );
  } else if (feed.stories.length === 0 && hasFilters) {
    feedBody = (
      <EmptyState
        title="No stories match these filters"
        description={
          filters.label
            ? "Sentiment filters only include AI-analyzed stories. Try another filter or a longer time range."
            : "Try another coin, impact level or a longer time range."
        }
        actionLabel="Clear filters"
        onAction={() => setFilters({ label: null, asset: null, impact: null })}
      />
    );
  } else if (feed.stories.length === 0) {
    feedBody = (
      <EmptyState
        title="No trader-relevant news yet"
        description={
          snapshot ? `The next batch is due around ${formatClockTime(snapshot.nextUpdateAt)}.` : "Check back after the next news batch."
        }
      />
    );
  } else {
    feedBody = (
      <div className="flex flex-col gap-3">
        {topStory && <TopStoryCard story={topStory} now={now} onAssetClick={showAsset} />}

        {restStories.map((story) => (
          <NewsStoryCard key={story.clusterId} story={story} now={now} onAssetClick={showAsset} />
        ))}

        {feed.isLoadingMore && <StoryCardSkeleton />}

        {feed.hasMore && !feed.isLoadingMore && (
          <button
            type="button"
            onClick={() => feed.loadMore()}
            className="rounded-xl border bg-white py-3 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          >
            Load more
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <NewStoriesPill count={newCount} onClick={showNewStories} />

      {/* Sticky compact header while scrolled past the full one */}
      {snapshot && headerOutOfView && (
        <div className="fixed inset-x-0 top-14 z-30 border-b bg-white/95 backdrop-blur animate-in fade-in slide-in-from-top-1">
          <div className="mx-auto flex h-10 max-w-5xl items-center gap-3 px-3 text-xs sm:px-4">
            <span className="hidden font-semibold sm:inline">Market sentiment</span>
            {snapshot.sentiment && snapshot.label ? (
              <>
                <SentimentBadge label={snapshot.label} percent={snapshot.sentiment[snapshot.label]} />
                <SentimentSplitBar split={snapshot.sentiment} size="sm" showLegend={false} className="hidden max-w-48 flex-1 sm:flex" />
              </>
            ) : (
              <span className="text-muted-foreground">AI sentiment pending</span>
            )}
            {snapshot.market && (
              <span className="ml-auto whitespace-nowrap text-muted-foreground">
                Mkt cap 24h{" "}
                <span className={`font-semibold ${snapshot.market.marketCapChange24hPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {formatSignedPct(snapshot.market.marketCapChange24hPct, 1)}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      <div ref={headerRef}>
        {snapshot ? <GlobalSentimentHeader snapshot={snapshot} /> : <HeaderSkeleton />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {/* Sidebar: right column on desktop, a sideways strip above the feed below that */}
        <aside
          aria-label="Market sentiment details"
          className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-4 sm:px-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <SentimentByAssetList assets={snapshot?.byAsset ?? []} activeAsset={filters.asset} onSelect={showAsset} />
          <SentimentTrendChart points={trend.points} isLoading={trend.isLoading} />
          <TrendingTags tags={snapshot?.trendingTags ?? []} />
        </aside>

        <section aria-labelledby="news-feed-title" className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <div ref={topRef} className="flex scroll-mt-28 items-end justify-between gap-3">
            <div>
              <h2 id="news-feed-title" className="text-lg font-bold">
                Trader News
              </h2>
              <p className="text-xs text-muted-foreground">
                Market-moving crypto stories, one card per event
              </p>
            </div>
            {feed.isValidating && feed.stories.length > 0 && (
              <RefreshCw className="mb-1 h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Updating" />
            )}
          </div>

          <NewsFilterBar filters={filters} onChange={setFilters} />

          <div aria-busy={feed.isLoading}>{feedBody}</div>

          <AiDisclaimer className="justify-center py-2" />
        </section>
      </div>

      {/* Keep showing the last good data; just offer a retry */}
      {refreshFailed && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900 py-2 pl-4 pr-2 text-xs text-white shadow-lg">
          Couldn&apos;t refresh news
          <button
            type="button"
            onClick={() => {
              global.retry();
              feed.reload();
            }}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
