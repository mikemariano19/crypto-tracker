"use client";

import { useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  Building2,
  ChartCandlestick,
  CircleDollarSign,
  Cpu,
  Fish,
  Flame,
  Gavel,
  Gift,
  Handshake,
  Hourglass,
  Landmark,
  LockOpen,
  Newspaper,
  Scale,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SentimentLabel } from "@/types/news";

// One icon per story tag from the backend's keyword config.
const TOPIC_ICONS: Record<string, LucideIcon> = {
  ETF: ChartCandlestick,
  Regulation: Gavel,
  Legal: Scale,
  Security: ShieldAlert,
  Liquidations: Flame,
  Macro: Landmark,
  Exchange: ArrowLeftRight,
  Unlock: LockOpen,
  Halving: Hourglass,
  Stablecoin: CircleDollarSign,
  Risk: TriangleAlert,
  Upgrade: Cpu,
  Whales: Fish,
  Flows: Waves,
  Institutional: Building2,
  Price: TrendingUp,
  Derivatives: Activity,
  Airdrop: Gift,
  "M&A": Handshake,
};

// Soft washes matching the sentiment palette; slate when not analyzed.
const MOOD_GRADIENTS: Record<SentimentLabel | "none", string> = {
  bullish: "from-emerald-50 via-white to-emerald-100",
  bearish: "from-rose-50 via-white to-rose-100",
  neutral: "from-slate-100 via-white to-slate-200",
  none: "from-slate-100 via-slate-50 to-indigo-100",
};

export type ImageFallbackProps = {
  label: string;
  caption?: string;
  /** Coin logo for the story's main asset. */
  logo?: string | null;
  /** First story tag, picks an icon when there's no coin logo. */
  topic?: string | null;
  /** Outlet icon, the last resort before plain text. */
  sourceIcon?: string | null;
  mood?: SentimentLabel | null;
};

/**
 * Stand-in when a story has no usable image: the coin's logo (or a topic
 * icon, or the outlet's icon) on a wash tinted by the story's sentiment.
 */
function ImageFallback({
  label,
  caption,
  logo,
  topic,
  sourceIcon,
  mood,
  className,
}: ImageFallbackProps & { className?: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const usable = (url?: string | null): url is string => !!url && !failed.includes(url);

  const TopicIcon = topic ? TOPIC_ICONS[topic] : undefined;
  const picture = usable(logo) ? logo : TopicIcon ? null : usable(sourceIcon) ? sourceIcon : null;
  const Icon = picture ? null : (TopicIcon ?? Newspaper);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 overflow-hidden bg-linear-to-br",
        MOOD_GRADIENTS[mood ?? "none"],
        className
      )}
    >
      {/* Faint rings for texture */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full border-10 border-white/70" />
      <div className="absolute -bottom-8 -left-4 h-28 w-28 rounded-full border-12 border-white/50" />

      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed((list) => [...list, picture])}
          className="relative h-1/3 max-h-20 min-h-8 w-auto rounded-full bg-white object-contain p-1 shadow-sm ring-1 ring-black/5"
        />
      ) : (
        Icon && (
          <span className="relative flex aspect-square h-1/3 max-h-20 min-h-8 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-black/5">
            <Icon className="h-1/2 w-1/2 text-slate-500" strokeWidth={1.75} />
          </span>
        )
      )}

      <span className="relative flex flex-col items-center">
        <span className="text-base font-black tracking-tight text-slate-700 sm:text-lg">{label}</span>
        {caption && <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{caption}</span>}
      </span>
    </div>
  );
}

/**
 * An outlet's thumbnail, lazy-loaded in a fixed-ratio box so it never
 * shifts the layout. Falls back to a branded tile if the image is missing
 * or fails to load.
 */
export default function StoryImage({
  src,
  className,
  ...fallback
}: ImageFallbackProps & {
  src: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <ImageFallback {...fallback} className={className} />;
  }

  return (
    // Thumbnails come from each outlet's own CDN; next/image would need
    // every host allow-listed, so a plain lazy <img> is used instead.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn("bg-gray-100 object-cover", className)}
    />
  );
}
