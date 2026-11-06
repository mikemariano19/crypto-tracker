"use client";

import type { ChartRange } from "@/types/chart";

export const CHART_RANGES: { value: ChartRange; label: string; period: string }[] = [
  { value: "1d", label: "1D", period: "past 24 hours" },
  { value: "7d", label: "7D", period: "past 7 days" },
  { value: "30d", label: "30D", period: "past 30 days" },
  { value: "90d", label: "90D", period: "past 90 days" },
  { value: "1y", label: "1Y", period: "past year" },
];

type Props = {
  value: ChartRange;
  onChange: (range: ChartRange) => void;
};

export default function TimeframeToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Chart time range"
      className="flex items-center gap-1 rounded-lg bg-gray-100 p-1"
    >
      {CHART_RANGES.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
            value === option.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
