"use client";

import { ChevronDown } from "lucide-react";

import { SentimentIcon } from "@/components/news/SentimentBadge";
import type { Level, NewsFilters, NewsRange, NewsSort, SentimentLabel } from "@/types/news";

// Matches the tickers the backend tags (config/news_keywords.php).
export const COIN_FILTERS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "TRX", "AVAX", "LINK", "TON", "DOT", "LTC", "SUI", "USDT", "USDC"];

const SENTIMENTS: Array<{ value: SentimentLabel | null; label: string }> = [
  { value: null, label: "All" },
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "neutral", label: "Neutral" },
];

const RANGES: Array<{ value: NewsRange; label: string }> = [
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "3d", label: "3d" },
];

const SORTS: Array<{ value: NewsSort; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "impact", label: "Impact" },
];

// Same segmented control as the market table's All Coins / Favorites tabs.
const GROUP = "inline-flex shrink-0 rounded-lg bg-gray-100 p-1";

function segmentClass(selected: boolean) {
  return `inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
    selected ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
  }`;
}

function Segmented<T extends string | null>({
  label,
  options,
  value,
  onChange,
  icon,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  icon?: (value: T) => React.ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={GROUP}>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={segmentClass(value === option.value)}
        >
          {icon?.(option.value)}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SelectChip({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative inline-flex shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 appearance-none rounded-lg border bg-white py-1.5 pl-3 pr-8 text-xs font-semibold outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-ring/50 ${
          value ? "border-gray-900 text-gray-900" : "text-gray-600"
        }`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </label>
  );
}

/**
 * Sentiment, coin, impact, time range and sort. On phones it's one
 * sideways-scrolling row.
 */
export default function NewsFilterBar({
  filters,
  onChange,
}: {
  filters: NewsFilters;
  onChange: (changes: Partial<NewsFilters>) => void;
}) {
  return (
    <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      <Segmented
        label="Sentiment"
        options={SENTIMENTS}
        value={filters.label}
        onChange={(label) => onChange({ label })}
        icon={(value) => value && <SentimentIcon label={value} className="h-2 w-2 opacity-70" />}
      />

      <SelectChip label="Coin" value={filters.asset ?? ""} onChange={(asset) => onChange({ asset: asset || null })}>
        <option value="">All coins</option>
        {COIN_FILTERS.map((coin) => (
          <option key={coin} value={coin}>
            {coin}
          </option>
        ))}
      </SelectChip>

      <SelectChip
        label="Impact"
        value={filters.impact ?? ""}
        onChange={(impact) => onChange({ impact: (impact || null) as Level | null })}
      >
        <option value="">Any impact</option>
        <option value="high">High impact</option>
        <option value="medium">Medium impact</option>
        <option value="low">Low impact</option>
      </SelectChip>

      <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
        <Segmented label="Time range" options={RANGES} value={filters.range} onChange={(range) => onChange({ range })} />
        <Segmented label="Sort" options={SORTS} value={filters.sort} onChange={(sort) => onChange({ sort })} />
      </div>
    </div>
  );
}
