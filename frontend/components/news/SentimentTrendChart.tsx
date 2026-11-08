"use client";

import dynamic from "next/dynamic";
import { LineChart as LineChartIcon } from "lucide-react";

import SidebarCard from "@/components/news/SidebarCard";
import type { ChartPoint } from "@/components/news/SentimentTrendLines";
import { SENTIMENT_STYLES } from "@/lib/formatNews";
import type { SentimentTrendPoint } from "@/types/news";

// Recharts is a large library, so it downloads separately instead of with
// the page; the card, title and legend still render straight away.
const SentimentTrendLines = dynamic(() => import("@/components/news/SentimentTrendLines"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted" />,
});

function LegendItem({ label, text }: { label: "bullish" | "bearish"; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0.5 w-3 rounded-full" style={{ background: SENTIMENT_STYLES[label].line }} />
      {text}
    </span>
  );
}

/**
 * Bullish and bearish share of weighted news over the last 7 days.
 */
export default function SentimentTrendChart({
  points,
  isLoading,
}: {
  points: SentimentTrendPoint[];
  isLoading: boolean;
}) {
  const data: ChartPoint[] = points.map((point) => ({ ...point, time: new Date(point.at).getTime() }));
  const latest = data.at(-1);

  return (
    <SidebarCard
      title="Sentiment trend"
      subtitle="Last 7 days"
      icon={<LineChartIcon className="h-4 w-4 text-violet-500" />}
      iconClassName="bg-violet-50"
    >
      {data.length >= 2 ? (
        <>
          <div className="mb-2 flex gap-3 text-[11px] text-muted-foreground">
            <LegendItem label="bullish" text={`Bullish${latest ? ` ${latest.bullish}%` : ""}`} />
            <LegendItem label="bearish" text={`Bearish${latest ? ` ${latest.bearish}%` : ""}`} />
          </div>
          <div className="h-32 w-full" role="img" aria-label={latest ? `Latest: ${latest.bullish} percent bullish, ${latest.bearish} percent bearish` : undefined}>
            <SentimentTrendLines data={data} />
          </div>
        </>
      ) : isLoading ? (
        <div className="h-36 animate-pulse rounded-lg bg-muted" />
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          The trend fills in as AI-analyzed batches arrive.
        </p>
      )}
    </SidebarCard>
  );
}
