"use client";

import { LineChart as LineChartIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import SidebarCard from "@/components/news/SidebarCard";
import { SENTIMENT_STYLES } from "@/lib/formatNews";
import type { SentimentTrendPoint } from "@/types/news";

type ChartPoint = SentimentTrendPoint & { time: number };

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-gray-900">
        {new Date(point.time).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
      {(["bullish", "neutral", "bearish"] as const).map((label) => (
        <p key={label} className="flex items-center justify-between gap-4 text-gray-600">
          <span className="inline-flex items-center gap-1.5 capitalize">
            <span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_STYLES[label].line }} />
            {label}
          </span>
          <span className="font-semibold tabular-nums text-gray-900">{point[label]}%</span>
        </p>
      ))}
    </div>
  );
}

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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value: number) => new Date(value).toLocaleDateString(undefined, { weekday: "short" })}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#9ca3af", strokeDasharray: "4 4" }} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="bullish"
                  stroke={SENTIMENT_STYLES.bullish.line}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="bearish"
                  stroke={SENTIMENT_STYLES.bearish.line}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
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
