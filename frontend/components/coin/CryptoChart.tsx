"use client";

import { formatAxisPrice } from "@/lib/formatAxisPrice";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type ChartPoint = {
  timestamp: number;
  price: number;
  volume: number | null;
};

type Props = {
  coinId: string;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
};

const ranges = [
  { label: "1D", days: "1" },
  { label: "7D", days: "7" },
  { label: "30D", days: "30" },
  { label: "1Y", days: "365" },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 8,
});

function formatPrice(value: number) {
  return currency.format(value);
}

function formatDate(timestamp: number, includeYear = false) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatVolume(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="min-w-[210px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <p className="text-xs font-medium text-gray-500">
        {formatDate(point.timestamp, true)}
      </p>

      <p className="mb-3 text-xs text-gray-500">
        {formatTime(point.timestamp)}
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <span className="h-2 w-2 rounded-full bg-green-600" />
            Price
          </span>

          <span className="text-sm font-bold text-gray-900">
            {formatPrice(point.price)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Volume
          </span>

          <span className="text-sm font-semibold text-gray-700">
            {point.volume === null
              ? "Unavailable"
              : `$${formatVolume(point.volume)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CryptoChart({ coinId }: Props) {
  const [days, setDays] = useState("7");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchChart() {
      setLoading(true);
      setError(false);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/coin/${coinId}/chart?days=${days}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`Chart request failed: ${res.status}`);
        }

        const json = await res.json();
        const chart = json.data;

        const prices: [number, number][] = chart.prices ?? [];
        const volumes: [number, number][] = chart.total_volumes ?? [];

        const formatted: ChartPoint[] = prices.map(
          ([timestamp, price], index) => ({
            timestamp,
            price,
            volume: volumes[index]?.[1] ?? null,
          })
        );

        if (!controller.signal.aborted) {
          setData(formatted);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Failed to fetch chart:", err);
        setData([]);
        setError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchChart();

    return () => controller.abort();
  }, [coinId, days, retryCount]);

  const prices = data.map((point) => point.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.08;

  return (
    <section className="w-full rounded-xl border bg-white p-3 shadow-sm sm:p-5">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">
            Price Chart
          </h2>

          <p className="text-xs text-gray-500">
            Historical price and trading volume
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {ranges.map((range) => (
            <button
              key={range.days}
              type="button"
              disabled={loading || days === range.days}
              onClick={() => setDays((current) => current)}
              aria-pressed={days === range.days}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === range.days
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart states */}
      {loading ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 sm:h-[360px]">
          Loading price history...
        </div>
      ) : error || data.length === 0 ? (
        <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center sm:h-[360px]">
          <p className="text-sm font-medium text-gray-700">
            Unable to load chart data
          </p>
          <p className="text-xs text-gray-500">
            Please try another time range.
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Current/latest price */}
          <div className="mb-2">
            <p className="text-2xl font-bold tracking-tight text-gray-900">
              {formatPrice(data[data.length - 1].price)}
            </p>
            <p className="text-xs text-gray-500">
              Latest available chart price
            </p>
          </div>

          <div className="h-[280px] w-full sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 12, right: 4, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value: number) =>
                    days === "1"
                      ? formatTime(value)
                      : formatDate(value)
                  }
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  tickMargin={10}
                />

                <YAxis
                  yAxisId="price"
                  orientation="right"
                  domain={[
                    Math.max(0, minPrice - padding),
                    maxPrice + padding || "auto",
                  ]}
                  tickFormatter={formatAxisPrice}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  width={65}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: "#9ca3af",
                    strokeDasharray: "4 4",
                  }}
                  isAnimationActive={false}
                />

                <ReferenceLine
                  yAxisId="price"
                  y={data[data.length - 1].price}
                  stroke="#16a34a"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                />

                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  name="Price"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#16a34a",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              Price (USD)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Volume (USD)
            </span>
          </div>
        </>
      )}
    </section>
  );
}