import { Circle, TriangleDown, TriangleUp } from "@/components/news/SentimentIcons";
import { LABEL_TEXT, SENTIMENT_STYLES } from "@/lib/formatNews";
import { cn } from "@/lib/utils";
import type { SentimentLabel } from "@/types/news";

export function SentimentIcon({ label, className }: { label: SentimentLabel; className?: string }) {
  const Icon = label === "bullish" ? TriangleUp : label === "bearish" ? TriangleDown : Circle;

  return <Icon className={cn("h-2.5 w-2.5 shrink-0", className)} />;
}

/**
 * "▲ BULLISH 72%". Text and icon carry the meaning; color only reinforces it.
 */
export default function SentimentBadge({
  label,
  percent,
  size = "sm",
}: {
  label: SentimentLabel;
  percent?: number;
  size?: "sm" | "lg";
}) {
  const style = SENTIMENT_STYLES[label];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-bold uppercase tracking-wide",
        style.bg,
        style.text,
        size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
      )}
    >
      <SentimentIcon label={label} />
      {LABEL_TEXT[label]}
      {percent !== undefined && <span className="tabular-nums">{percent}%</span>}
    </span>
  );
}
