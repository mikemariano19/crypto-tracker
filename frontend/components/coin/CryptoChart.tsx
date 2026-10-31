"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  useCoinChart,
  type ChartPoint,
  type ChartRange,
} from "@/hooks/useCoinChart";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { formatFiatAxis, formatFiatCompact, formatFiatPrice, type Money } from "@/lib/money";

type Props = {
  coinId: string;
  // The profile's live price; the chart ends on it so both always agree.
  livePrice?: number | null;
  liveUpdatedAt?: string | null;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  days: ChartRange;
  money: Money;
};

const RANGES: { label: string; days: ChartRange; period: string }[] = [
  { label: "24H", days: "1", period: "past 24 hours" },
  { label: "7D", days: "7", period: "past 7 days" },
  { label: "30D", days: "30", period: "past 30 days" },
  { label: "90D", days: "90", period: "past 90 days" },
  { label: "1Y", days: "365", period: "past year" },
];

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#ef4444";
const VOLUME_COLOR = "var(--chart-volume)";

const CHART_HEIGHT = "h-[300px] sm:h-[380px]";

function formatTick(timestamp: number, days: ChartRange) {
  const date = new Date(timestamp);

  if (days === "1") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  if (days === "365") {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, days, money }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const date = new Date(point.timestamp);

  return (
    <div className="min-w-48 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-2 text-[11px] font-medium text-gray-500">
        {date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
        {days !== "365" &&
          ` · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500">Price</span>
          <span className="text-sm font-bold text-gray-900">
            {formatFiatPrice(point.price, money)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500">Volume</span>
          <span className="text-xs font-semibold text-gray-700">
            {formatFiatCompact(point.volume, money)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="truncate text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function CryptoChart({ coinId, livePrice, liveUpdatedAt }: Props) {
  const [days, setDays] = useState<ChartRange>("7");
  // History stays in USD; only the labels are converted.
  const { money } = useDisplayCurrency();
  const {
    points: historyPoints,
    isLoading,
    isValidating,
    isError,
    retry,
  } = useCoinChart(coinId, days);

  // Chart history is cached longer than the live price, so its last point
  // can lag. Finish the line at the live price instead.
  const points = useMemo<ChartPoint[]>(() => {
    const last = historyPoints[historyPoints.length - 1];
    const liveAt = liveUpdatedAt ? new Date(liveUpdatedAt).getTime() : NaN;

    if (!last || livePrice == null || !Number.isFinite(livePrice) || !Number.isFinite(liveAt)) {
      return historyPoints;
    }

    if (liveAt <= last.timestamp) {
      return [...historyPoints.slice(0, -1), { ...last, price: livePrice }];
    }

    return [...historyPoints, { timestamp: liveAt, price: livePrice, volume: last.volume }];
  }, [historyPoints, livePrice, liveUpdatedAt]);

  const range = RANGES.find((r) => r.days === days) ?? RANGES[1];
  const hasData = points.length > 1;
  // keepPreviousData shows the old range while a new one loads.
  const isSwitching = hasData && isLoading;

  const summary = useMemo(() => {
    if (points.length < 2) return null;

    const prices = points.map((point) => point.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const maxVolume = Math.max(0, ...points.map((point) => point.volume ?? 0));
    const spread = high - low || high * 0.01;

    return {
      first,
      last,
      low,
      high,
      change: first ? ((last - first) / first) * 100 : 0,
      // Leave the bottom of the plot free for volume bars.
      priceDomain: [Math.max(0, low - spread * 0.35), high + spread * 0.08],
      // Volume bars use the lowest ~quarter of the plot.
      volumeDomain: [0, maxVolume * 4 || 1],
    };
  }, [points]);

  const isUp = (summary?.change ?? 0) >= 0;
  const color = isUp ? UP_COLOR : DOWN_COLOR;
  const gradientId = `price-fill-${coinId}`;

  return (
    <section className="w-full rounded-xl bg-card p-3 shadow-sm ring-1 ring-foreground/10 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">
            Price Chart
          </h2>

          {summary ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold tracking-tight text-gray-900">
                {formatFiatPrice(summary.last, money)}
              </span>

              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                }`}
              >
                {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(summary.change).toFixed(2)}%
              </span>

              <span className="text-xs text-gray-500">{range.period}</span>
            </div>
          ) : (
            <div className="mt-2 h-7 w-48 animate-pulse rounded bg-gray-100" />
          )}
        </div>

        <div
          role="group"
          aria-label="Chart time range"
          className="flex items-center gap-1 rounded-lg bg-gray-100 p-1"
        >
          {RANGES.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => setDays(option.days)}
              aria-pressed={days === option.days}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
                days === option.days
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {hasData && summary ? (
        <div className={`relative w-full ${CHART_HEIGHT}`}>
          {isSwitching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading" />
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />

              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value: number) => formatTick(value, days)}
                tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickMargin={8}
              />

              <YAxis
                yAxisId="price"
                orientation="right"
                domain={summary.priceDomain}
                tickFormatter={(value: number) => formatFiatAxis(value, money)}
                tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                tickLine={false}
                axisLine={false}
                tickCount={6}
                width={64}
              />

              <YAxis yAxisId="volume" domain={summary.volumeDomain} hide />

              <Tooltip
                content={<ChartTooltip days={days} money={money} />}
                cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "4 4" }}
                isAnimationActive={false}
              />

              <Bar
                yAxisId="volume"
                dataKey="volume"
                fill={VOLUME_COLOR}
                fillOpacity={0.6}
                isAnimationActive={false}
              />

              {/* Where the period started, to read the change at a glance */}
              <ReferenceLine
                yAxisId="price"
                y={summary.first}
                stroke="var(--chart-axis)"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />

              <Area
                yAxisId="price"
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : isError && !isLoading ? (
        <div className={`flex ${CHART_HEIGHT} flex-col items-center justify-center gap-2 text-center`}>
          <p className="text-sm font-medium text-gray-700">
            Chart data is temporarily unavailable
          </p>
          <p className="text-xs text-gray-500">
            We&apos;ll keep retrying automatically.
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={isValidating}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
            Try again
          </button>
        </div>
      ) : (
        <div className={`${CHART_HEIGHT} w-full animate-pulse rounded-lg bg-gray-100`} />
      )}

      {/* Range stats */}
      {summary && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
          <Stat label={`${range.label} Low`} value={formatFiatPrice(summary.low, money)} />
          <Stat label={`${range.label} High`} value={formatFiatPrice(summary.high, money)} />
          <Stat
            label="24h Volume"
            value={formatFiatCompact(points[points.length - 1].volume, money)}
          />
        </div>
      )}
    </section>
  );
}
