"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, ChevronDown, Clock, PieChart, Sparkles, Waves } from "lucide-react";

import SentimentGauge from "@/components/news/SentimentGauge";
import SentimentSplitBar from "@/components/news/SentimentSplitBar";
import SentimentBadge from "@/components/news/SentimentBadge";
import AiDisclaimer from "@/components/news/AiDisclaimer";
import { formatCompactUsd, formatFullUsd } from "@/lib/formatCompactUsd";
import { formatClockTime, formatLocalTime, formatRelativeTime, formatSignedPct } from "@/lib/formatNews";
import { useNow } from "@/hooks/useNow";
import type { GlobalSentimentSnapshot } from "@/types/news";

// "News may be out of date" once a batch is this late.
const STALE_GRACE_MS = 30 * 60_000;

const LABEL = "text-[10px] uppercase tracking-wide text-muted-foreground";

function MarketStat({
  icon,
  label,
  value,
  title,
  change,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  title?: string;
  change?: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">{icon}</div>
      <div className="min-w-0">
        <p className={LABEL}>{label}</p>
        <p className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold" title={title}>
          {value}
          {change !== undefined && (
            <span
              className={`inline-flex items-center text-[11px] font-semibold ${
                change >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {formatSignedPct(change).replace(/^[+-]/, "")}
              <span className="sr-only">{change >= 0 ? " up" : " down"} in 24 hours</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function PendingSentiment({ analyzed, total }: { analyzed: number; total: number }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-gray-50 px-4 py-5 text-center sm:w-44">
      <Sparkles className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-semibold text-gray-900">AI sentiment pending</p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {total > 0
          ? `${total} relevant ${total === 1 ? "story" : "stories"} today, ${analyzed} AI-analyzed`
          : "Waiting for the first news batch"}
      </p>
    </div>
  );
}

/**
 * Top of the news page: overall bull/bear/neutral, global market numbers,
 * the AI market summary and when the next batch is due. On phones it
 * collapses to one line and expands on tap.
 */
export default function GlobalSentimentHeader({ snapshot }: { snapshot: GlobalSentimentSnapshot }) {
  const now = useNow();
  const [expanded, setExpanded] = useState(false);

  const { sentiment, label, market } = snapshot;
  const nextUpdateAt = new Date(snapshot.nextUpdateAt).getTime();
  const isStale = now > 0 && now > nextUpdateAt + STALE_GRACE_MS;
  const nextIsOverdue = now > 0 && now > nextUpdateAt;

  return (
    <section aria-label="Global market sentiment" className="rounded-xl border bg-white shadow-sm">
      {/* Phone: one-line summary that toggles the full header */}
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls="global-sentiment-body"
        className="flex w-full items-center gap-2 px-4 py-3 text-left sm:hidden"
      >
        <span className="text-sm font-bold">Market Sentiment</span>
        {sentiment && label ? (
          <SentimentBadge label={label} percent={sentiment[label]} />
        ) : (
          <span className="text-xs text-muted-foreground">AI pending</span>
        )}
        {market && (
          <span
            className={`ml-auto text-xs font-semibold ${
              market.marketCapChange24hPct >= 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {formatSignedPct(market.marketCapChange24hPct, 1)}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${market ? "" : "ml-auto"} ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div id="global-sentiment-body" className={`${expanded ? "block" : "hidden"} border-t p-4 sm:block sm:border-t-0`}>
        <div className="mb-3 hidden items-center justify-between gap-3 sm:flex">
          <div>
            <h1 className="text-lg font-bold">
              Global Market Sentiment
            </h1>
            <p className="text-xs text-muted-foreground">
              Weighted by impact, recency and source over the last 24h
              {snapshot.sentimentStoryCount > 0 && ` · ${snapshot.sentimentStoryCount} analyzed stories`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {sentiment && label ? (
            <SentimentGauge split={sentiment} label={label} />
          ) : (
            <PendingSentiment analyzed={snapshot.analyzedLast24h} total={snapshot.storiesLast24h} />
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {sentiment && <SentimentSplitBar split={sentiment} size="xl" legend="side" />}

            {market ? (
              <div className="grid grid-cols-2 gap-3 border-y py-3 sm:grid-cols-3">
                <MarketStat
                  icon={<BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />}
                  label="Global Mkt Cap"
                  value={formatCompactUsd(market.totalMarketCapUsd)}
                  title={formatFullUsd(market.totalMarketCapUsd)}
                  change={market.marketCapChange24hPct}
                />
                <MarketStat
                  icon={<PieChart className="h-3.5 w-3.5 text-orange-500" />}
                  label="BTC Dominance"
                  value={`${market.btcDominancePct.toFixed(1)}%`}
                />
                <MarketStat
                  icon={<Waves className="h-3.5 w-3.5 text-muted-foreground" />}
                  label="24h Volume"
                  value={formatCompactUsd(market.totalVolumeUsd)}
                  title={formatFullUsd(market.totalVolumeUsd)}
                />
              </div>
            ) : (
              <div className="h-14 animate-pulse rounded-lg bg-muted" />
            )}

            {snapshot.aiSummary && (
              <div className="flex gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-gray-700">
                  <span className="font-semibold text-gray-900">AI summary: </span>
                  {snapshot.aiSummary}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {snapshot.updatedAt ? (
              <span title={formatLocalTime(snapshot.updatedAt)}>
                Updated {now ? formatRelativeTime(snapshot.updatedAt, now) : formatClockTime(snapshot.updatedAt)}
              </span>
            ) : (
              "No batch yet"
            )}
          </span>
          <span title={formatLocalTime(snapshot.nextUpdateAt)}>
            {nextIsOverdue ? "Next update overdue" : `Next update ~${formatClockTime(snapshot.nextUpdateAt)}`}
          </span>
          <AiDisclaimer className="sm:ml-auto" />
        </div>

        {isStale && (
          <p
            role="status"
            className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            News may be out of date. The last scheduled update hasn&apos;t arrived yet.
          </p>
        )}
      </div>
    </section>
  );
}
