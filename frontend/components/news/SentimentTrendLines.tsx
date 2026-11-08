"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SENTIMENT_STYLES } from "@/lib/formatNews";
import type { SentimentTrendPoint } from "@/types/news";

export type ChartPoint = SentimentTrendPoint & { time: number };

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

/**
 * The Recharts drawing for the sentiment trend card. Its own file so Recharts
 * is a separate download, fetched only when the chart is about to show.
 */
export default function SentimentTrendLines({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(value: number) => new Date(value).toLocaleDateString(undefined, { weekday: "short" })}
          tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tickFormatter={(value: number) => `${value}%`}
          tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
          tickLine={false}
          axisLine={false}
          width={34}
        />
        <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "4 4" }} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="bullish"
          stroke={SENTIMENT_STYLES.bullish.line}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="bearish"
          stroke={SENTIMENT_STYLES.bearish.line}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
