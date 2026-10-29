import { LABEL_TEXT, SENTIMENT_STYLES, sentimentAriaLabel } from "@/lib/formatNews";
import { cn } from "@/lib/utils";
import type { SentimentLabel, SentimentSplit } from "@/types/news";

const ORDER: SentimentLabel[] = ["bullish", "neutral", "bearish"];

const SIZES = {
  // Thin bar, no numbers (compact views that show the % elsewhere).
  sm: { bar: "h-1.5", text: "", showValues: false },
  md: { bar: "h-4", text: "text-[9px]", showValues: true },
  lg: { bar: "h-5", text: "text-[10px]", showValues: true },
  xl: { bar: "h-6", text: "text-[11px]", showValues: true },
};

/**
 * ● Bullish ● Neutral ● Bearish
 */
export function SentimentLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground", className)} aria-hidden="true">
      {ORDER.map((label) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-full ring-1 ring-black/5", SENTIMENT_STYLES[label].bar)} />
          {LABEL_TEXT[label]}
        </li>
      ))}
    </ul>
  );
}

/**
 * Bull | neutral | bear as one bar with each % printed inside its segment.
 * Small segments keep a minimum width so their number stays readable.
 */
export default function SentimentSplitBar({
  split,
  size = "lg",
  showLegend = true,
  legend = "below",
  className,
}: {
  split: SentimentSplit;
  size?: keyof typeof SIZES;
  showLegend?: boolean;
  // "side" only where the bar has room to spare (the wide header).
  legend?: "below" | "side";
  className?: string;
}) {
  const { bar, text, showValues } = SIZES[size];
  const segments = ORDER.filter((label) => split[label] > 0);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        legend === "side" && "sm:flex-row sm:items-center sm:gap-3",
        className
      )}
    >
      <div
        role="img"
        aria-label={sentimentAriaLabel(split)}
        // 2px gaps keep neighbouring segments apart.
        className={cn("flex min-w-0 flex-1 gap-0.5 overflow-hidden rounded-full", bar)}
      >
        {segments.map((label) => (
          <div
            key={label}
            className={cn(
              "flex h-full items-center justify-center font-bold tabular-nums",
              SENTIMENT_STYLES[label].bar,
              SENTIMENT_STYLES[label].barText,
              text
            )}
            style={{
              flexGrow: split[label],
              flexBasis: 0,
              minWidth: showValues ? "2.25rem" : undefined,
            }}
          >
            {showValues && `${split[label]}%`}
          </div>
        ))}
      </div>

      {showLegend && <SentimentLegend className="shrink-0" />}
    </div>
  );
}
