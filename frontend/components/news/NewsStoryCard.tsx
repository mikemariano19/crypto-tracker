"use client";

import { useId, useState } from "react";
import { ChevronUp, ExternalLink, Layers } from "lucide-react";

import SentimentBadge from "@/components/news/SentimentBadge";
import SentimentSplitBar from "@/components/news/SentimentSplitBar";
import TraderTakePanel from "@/components/news/TraderTakePanel";
import StoryImage from "@/components/news/StoryImage";
import SourceMark from "@/components/news/SourceMark";
import { useCoinLogos } from "@/hooks/useCoinLogos";
import { LEVEL_TEXT, SENTIMENT_STYLES, formatLocalTime, formatRelativeTime } from "@/lib/formatNews";
import { cn } from "@/lib/utils";
import type { Level, NewsStory } from "@/types/news";

const IMPACT_DOTS: Record<Level, number> = { low: 1, medium: 2, high: 3 };

export function hasSentiment(story: NewsStory): boolean {
  return story.analyzed && story.sentiment !== null && story.label !== null;
}

export function stripeClass(story: NewsStory): string {
  return hasSentiment(story) && story.label ? SENTIMENT_STYLES[story.label].stripe : "border-l-gray-200";
}

/**
 * "●●● High impact": filled dots plus text, no color meaning.
 */
export function ImpactMeter({ impact }: { impact: Level }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((dot) => (
          <span
            key={dot}
            className={`h-1.5 w-1.5 rounded-full ${dot <= IMPACT_DOTS[impact] ? "bg-gray-700" : "bg-gray-200"}`}
          />
        ))}
      </span>
      {LEVEL_TEXT[impact]} impact
    </span>
  );
}

/**
 * Sentiment badge + impact, the first line of every card.
 */
export function StoryMeta({ story, size = "sm", children }: { story: NewsStory; size?: "sm" | "lg"; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {children}
      {hasSentiment(story) && story.label && story.sentiment && (
        <SentimentBadge label={story.label} percent={story.sentiment[story.label]} size={size} />
      )}
      <ImpactMeter impact={story.impact} />
    </div>
  );
}

/**
 * [C] CoinDesk · 2h ago · +3 sources
 */
export function SourceLine({
  source,
  sourceIcon = null,
  publishedAt,
  now,
  relatedCount = 0,
  sourcesOpen = false,
  sourcesId,
  onToggleSources,
}: {
  source: string;
  sourceIcon?: string | null;
  publishedAt: string;
  now: number;
  relatedCount?: number;
  sourcesOpen?: boolean;
  sourcesId?: string;
  onToggleSources?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
      <SourceMark name={source} iconUrl={sourceIcon} />
      <span className="font-semibold text-gray-800">{source}</span>
      {now > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={publishedAt} title={formatLocalTime(publishedAt)}>
            {formatRelativeTime(publishedAt, now)}
          </time>
        </>
      )}
      {relatedCount > 0 && onToggleSources && (
        <>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onToggleSources}
            aria-expanded={sourcesOpen}
            aria-controls={sourcesId}
            className="inline-flex items-center gap-1 rounded font-medium text-gray-700 hover:text-gray-900 hover:underline"
          >
            <Layers className="h-3 w-3" aria-hidden="true" />+{relatedCount} {relatedCount === 1 ? "source" : "sources"}
          </button>
        </>
      )}
    </div>
  );
}

export function Headline({ story, className }: { story: NewsStory; className?: string }) {
  return (
    <h3 className={cn("font-bold leading-snug text-gray-900", className)}>
      <a
        href={story.url}
        target="_blank"
        rel="noopener noreferrer"
        className="decoration-gray-300 underline-offset-2 hover:underline"
      >
        {story.headline}
        <ExternalLink className="ml-1 inline h-3 w-3 align-baseline text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </h3>
  );
}

/**
 * Our AI summary, or the feed's own short description when not analyzed.
 */
export function StoryText({ story, className }: { story: NewsStory; className?: string }) {
  const text = hasSentiment(story) ? story.summary : story.snippet;
  if (!text) return null;

  return <p className={cn("text-[13px] leading-relaxed text-gray-600", className)}>{text}</p>;
}

function TagChips({
  assets,
  tags,
  onAssetClick,
}: {
  assets: string[];
  tags: string[];
  onAssetClick?: (asset: string) => void;
}) {
  if (assets.length === 0 && tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {assets.map((asset) => (
        <button
          key={asset}
          type="button"
          onClick={() => onAssetClick?.(asset)}
          title={`Show ${asset} news`}
          className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-800 transition-colors hover:bg-gray-200"
        >
          {asset}
        </button>
      ))}
      {tags.map((tag) => (
        <span key={tag} className="rounded-md border px-1.5 py-0.5 text-[11px] text-gray-600">
          {tag}
        </span>
      ))}
    </div>
  );
}

/**
 * Sentiment split, coin/topic chips and the AI trader take.
 */
export function StoryInsights({
  story,
  onAssetClick,
}: {
  story: NewsStory;
  onAssetClick?: (asset: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {hasSentiment(story) && story.sentiment && <SentimentSplitBar split={story.sentiment} />}

      <TagChips assets={story.assets} tags={story.tags} onAssetClick={onAssetClick} />

      {hasSentiment(story) && story.traderTake ? (
        <TraderTakePanel take={story.traderTake} assets={story.assets} confidence={story.confidence} />
      ) : (
        !story.analyzed && <p className="text-[11px] italic text-muted-foreground">Not AI-analyzed</p>
      )}
    </div>
  );
}

// Other outlets listed beside the image before "See all".
const PREVIEW_SOURCES = 3;

/**
 * The same event from other outlets: outlet, headline, time.
 */
function RelatedColumn({ story, now }: { story: NewsStory; now: number }) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const related = showAll ? story.related : story.related.slice(0, PREVIEW_SOURCES);

  return (
    <div className="flex min-w-0 flex-col">
      <ul id={listId} className="divide-y">
        {related.map((source) => (
          <li key={source.url} className="py-2.5 first:pt-0">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                  <SourceMark name={source.source} iconUrl={source.sourceIcon} />
                  {source.source}
                </span>
                <span className="line-clamp-2 text-sm leading-snug text-gray-700 group-hover:text-gray-900 group-hover:underline">
                  {source.headline}
                </span>
                {now > 0 && (
                  <span className="text-[11px] text-muted-foreground" title={formatLocalTime(source.publishedAt)}>
                    {formatRelativeTime(source.publishedAt, now)}
                  </span>
                )}
              </span>
              {/* Each outlet's own thumbnail, like Google News' source list */}
              {source.imageUrl && (
                <StoryImage
                  src={source.imageUrl}
                  label={source.source.charAt(0)}
                  className="h-16 w-16 shrink-0 rounded-lg sm:h-18 sm:w-18"
                />
              )}
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>

      {story.related.length > PREVIEW_SOURCES && (
        <button
          type="button"
          onClick={() => setShowAll((open) => !open)}
          aria-expanded={showAll}
          aria-controls={listId}
          className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-100 py-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Show fewer sources
            </>
          ) : (
            <>
              <Layers className="h-3.5 w-3.5" /> See all {story.related.length + 1} sources
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * One story, laid out like a Google News story block: the outlet's image
 * and headline on the left; on the right either the same event from other
 * outlets, or our summary, sentiment and trader take. `featured` is the
 * larger top-story version.
 */
export default function NewsStoryCard({
  story,
  now,
  featured = false,
  onAssetClick,
}: {
  story: NewsStory;
  now: number;
  featured?: boolean;
  onAssetClick?: (asset: string) => void;
}) {
  const hasRelated = story.related.length > 0;
  const logos = useCoinLogos();

  return (
    <article
      className={cn(
        "rounded-xl border border-l-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5",
        stripeClass(story)
      )}
    >
      <div className="mb-3">
        <StoryMeta story={story} size={featured ? "lg" : "sm"}>
          {featured && (
            <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Top story
            </span>
          )}
        </StoryMeta>
      </div>

      <div
        className={cn(
          "grid gap-4 sm:gap-5",
          featured ? "md:grid-cols-2" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        )}
      >
        {/* Image, outlet, headline */}
        <div className="flex min-w-0 flex-col gap-2">
          <a href={story.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
            <StoryImage
              src={story.imageUrl}
              label={story.assets[0] ?? story.tags[0] ?? story.source}
              caption={story.assets[0] || story.tags[0] ? story.source : undefined}
              logo={story.assets[0] ? logos[story.assets[0]] : null}
              topic={story.tags[0]}
              sourceIcon={story.sourceIcon}
              mood={hasSentiment(story) ? story.label : null}
              className={cn("w-full rounded-xl", featured ? "aspect-video" : "aspect-2/1 sm:aspect-16/10")}
            />
          </a>
          <SourceLine source={story.source} sourceIcon={story.sourceIcon} publishedAt={story.publishedAt} now={now} />
          <Headline story={story} className={featured ? "text-lg sm:text-xl" : "line-clamp-3 text-base"} />
          {hasRelated && <StoryText story={story} className={featured ? "line-clamp-3" : "line-clamp-2"} />}
        </div>

        {/* Other outlets, or our read of the story when there are none */}
        {hasRelated ? (
          <RelatedColumn story={story} now={now} />
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <StoryText story={story} className={featured ? "line-clamp-5 text-sm" : "line-clamp-4"} />
            <StoryInsights story={story} onAssetClick={onAssetClick} />
          </div>
        )}
      </div>

      {hasRelated && (
        <div className="mt-4 border-t pt-4">
          <StoryInsights story={story} onAssetClick={onAssetClick} />
        </div>
      )}
    </article>
  );
}
