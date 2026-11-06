"use client";

import type { InsightToggles } from "@/types/insight";

const OPTIONS: { key: keyof InsightToggles; label: string; title: string }[] = [
  { key: "ma", label: "MA", title: "Moving averages" },
  { key: "rsi", label: "RSI", title: "Relative strength index" },
  { key: "volume", label: "Volume", title: "24-hour volume" },
  { key: "sr", label: "S/R", title: "Support and resistance zones" },
];

type Props = {
  toggles: InsightToggles;
  onToggle: (key: keyof InsightToggles) => void;
  onClear: () => void;
};

export default function IndicatorToggles({ toggles, onToggle, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          title={option.title}
          aria-pressed={toggles[option.key]}
          onClick={() => onToggle(option.key)}
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
            toggles[option.key]
              ? "border-foreground bg-foreground text-background"
              : "bg-white text-gray-500 hover:text-gray-900"
          }`}
        >
          {option.label}
        </button>
      ))}

      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-md px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-gray-900"
      >
        Clear
      </button>
    </div>
  );
}
