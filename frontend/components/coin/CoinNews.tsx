"use client";

import Link from "next/link";
import { ChevronRight, Newspaper } from "lucide-react";
import ExternalLink from "@/components/ExternalLink";
import SentimentBadge from "@/components/news/SentimentBadge";
import SentimentSplitBar from "@/components/news/SentimentSplitBar";
import SourceMark from "@/components/news/SourceMark";
import { COIN_FILTERS } from "@/components/news/NewsFilterBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalSentiment } from "@/hooks/useGlobalSentiment";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import { useNow } from "@/hooks/useNow";
import { formatLocalTime, formatRelativeTime } from "@/lib/formatNews";

const MAX_STORIES = 5;

// Same rule as the news API's ?asset= check.
const ASSET_PATTERN = /^[A-Z0-9]{2,10}$/;

/**
 * Latest headlines that mention this coin, with its news sentiment, from
 * the same feed as the News page.
 */
export default function CoinNews({ symbol, name }: { symbol: string; name: string }) {
  const asset = symbol.toUpperCase();

  // The API would reject the request; nothing to show.
  if (!ASSET_PATTERN.test(asset)) return null;

  return <CoinNewsCard asset={asset} name={name} />;
}

function CoinNewsCard({ asset, name }: { asset: string; name: string }) {
  const now = useNow();
  const { stories, isLoading, isError } = useNewsFeed({ label: null, asset, impact: null, range: "3d", sort: "latest" });
  const { snapshot } = useGlobalSentiment();
  const sentiment = snapshot?.byAsset.find((entry) => entry.asset === asset);

  // The News page's coin filter only offers its own list.
  const allNewsHref = COIN_FILTERS.includes(asset) ? `/news?asset=${asset}` : "/news";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {name} News
        </CardTitle>
        <CardDescription>Headlines mentioning {asset} from the last 3 days</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {sentiment && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              News sentiment for {asset} · {sentiment.storyCount} {sentiment.storyCount === 1 ? "story" : "stories"}
            </p>
            {/* md, not sm: in the stacked layout the bar's height comes from its % labels */}
            <SentimentSplitBar split={sentiment.sentiment} size="md" legend="below" />
          </div>
        )}

        {isLoading ? (
          <ul className="space-y-3" aria-label="Loading news">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="space-y-1.5">
                <span className="block h-4 w-11/12 animate-pulse rounded bg-gray-200" />
                <span className="block h-3 w-1/3 animate-pulse rounded bg-gray-100" />
              </li>
            ))}
          </ul>
        ) : stories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isError ? "News couldn’t be loaded right now." : `No ${asset} headlines in the last 3 days.`}
          </p>
        ) : (
          <ul className="divide-y">
            {stories.slice(0, MAX_STORIES).map((story) => (
              <li key={story.clusterId} className="py-3 first:pt-0">
                <ExternalLink href={story.url} showIcon={false} className="text-sm font-semibold leading-snug text-gray-900 hover:underline">
                  {story.headline}
                </ExternalLink>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <SourceMark name={story.source} iconUrl={story.sourceIcon} />
                    {story.source}
                  </span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={story.publishedAt} title={formatLocalTime(story.publishedAt)}>
                    {now ? formatRelativeTime(story.publishedAt, now) : formatLocalTime(story.publishedAt)}
                  </time>
                  {story.label && <SentimentBadge label={story.label} />}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link href={allNewsHref} className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline">
          {allNewsHref === "/news" ? "All crypto news" : `All ${asset} news`}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
