import { LABEL_TEXT, SENTIMENT_STYLES, sentimentAriaLabel } from "@/lib/formatNews";
import type { SentimentLabel, SentimentSplit } from "@/types/news";

// Half circle from bearish (left) to bullish (right).
const R = 40;
const CX = 50;
const CY = 48;

function point(angle: number, radius = R) {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY - radius * Math.sin(angle),
  };
}

function arc(from: number, to: number) {
  const start = point(from);
  const end = point(to);

  return `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;
}

/**
 * Needle at net sentiment (bullish − bearish, −100…100). The label and
 * dominant % sit underneath as text.
 */
export default function SentimentGauge({
  split,
  label,
  size = 132,
}: {
  split: SentimentSplit;
  label: SentimentLabel;
  size?: number;
}) {
  const net = split.bullish - split.bearish;
  // π (far left, fully bearish) … 0 (far right, fully bullish).
  const angle = Math.PI * (1 - (net + 100) / 200);
  const tip = point(angle, R - 8);
  const style = SENTIMENT_STYLES[label];

  return (
    <figure
      className="flex shrink-0 flex-col items-center"
      style={{ width: size }}
      aria-label={`Market sentiment ${LABEL_TEXT[label]}: ${sentimentAriaLabel(split)}`}
      role="img"
    >
      <svg viewBox="0 0 100 56" className="w-full" aria-hidden="true">
        {/* Bearish → neutral → bullish zones, with small gaps between */}
        <path d={arc(Math.PI, Math.PI * 0.69)} stroke={SENTIMENT_STYLES.bearish.line} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={arc(Math.PI * 0.645, Math.PI * 0.355)} stroke={SENTIMENT_STYLES.neutral.line} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={arc(Math.PI * 0.31, 0)} stroke={SENTIMENT_STYLES.bullish.line} strokeWidth="7" fill="none" strokeLinecap="round" />

        <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="4" fill="var(--foreground)" />
        <circle cx={CX} cy={CY} r="1.5" fill="var(--card)" />
      </svg>

      <figcaption className="-mt-1 text-center">
        <p className={`text-lg font-bold leading-tight ${style.text}`}>{LABEL_TEXT[label]}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {split[label]}% of weighted news
        </p>
      </figcaption>
    </figure>
  );
}
