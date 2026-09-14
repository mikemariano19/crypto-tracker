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
} from "recharts";

type ChartPoint = {
  timestamp: number;
  price: number;
};

type Props = {
  coinId: string;
};

const ranges = [
  { label: "1D", days: "1" },
  { label: "7D", days: "7" },
  { label: "30D", days: "30" },
  { label: "1Y", days: "365" },
];

export default function CryptoChart({ coinId }: Props) {
  const [days, setDays] = useState("7");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChart() {
      setLoading(true);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/coin/${coinId}/chart?days=${days}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch chart");
        }

        const json = await res.json();

        const formatted = json.data.prices.map(
          ([timestamp, price]: [number, number]) => ({
            timestamp,
            price,
          })
        );

        setData(formatted);
      } catch (error) {
        console.error(error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchChart();
  }, [coinId, days]);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {ranges.map((range) => (
          <button
            key={range.days}
            onClick={() => setDays(range.days)}
            className={`rounded-md px-3 py-1 text-sm ${
              days === range.days
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-80 items-center justify-center">
          Loading chart...
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-80 items-center justify-center">
          No chart data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
                dataKey="date"
                tickFormatter={(date) =>
                    new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    })
                }
                />

                <YAxis
                orientation="right"
                tickFormatter={formatAxisPrice}
                />

                <Tooltip
                labelFormatter={() =>
                    new Date().toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: false,
                    })
                }
                formatter={(value, name) => [
                    name === "price"
                    ? `$${Number(value).toLocaleString()}`
                    : `$${Number(value).toLocaleString()}`,
                    name === "price" ? "Price" : "Volume",
                ]}
                />

            <Line
              type="monotone"
              dataKey="price"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}