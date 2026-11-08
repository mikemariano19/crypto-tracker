"use client";

import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, BellRing, CheckCircle2, Clock, Newspaper, Sunrise, Trash2, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PushCategory } from "@/types/push";

/** Each kind of alert gets its own icon and tint, in settings and history alike. */
export const CATEGORY_LOOK: Record<PushCategory, { icon: LucideIcon; tint: string }> = {
  price: { icon: BellRing, tint: "bg-blue-50 text-blue-600" },
  moves: { icon: Activity, tint: "bg-violet-50 text-violet-600" },
  market: { icon: TrendingUp, tint: "bg-emerald-50 text-emerald-600" },
  news: { icon: Newspaper, tint: "bg-amber-50 text-amber-600" },
  brief: { icon: Sunrise, tint: "bg-sky-50 text-sky-600" },
};

export function CategoryIcon({ category, className }: { category: PushCategory; className?: string }) {
  const { icon: Icon, tint } = CATEGORY_LOOK[category] ?? CATEGORY_LOOK.price;

  return (
    <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tint, className)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/**
 * An on/off switch. A real button with role="switch", so keyboards and
 * screen readers treat it as one; `labelledBy` points at its visible label.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  labelledBy: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-emerald-600" : "bg-gray-300",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Coin ticker in a small round badge, for rows without a logo at hand. */
export function SymbolBadge({ symbol, muted }: { symbol: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase",
        muted ? "bg-gray-100 text-gray-500" : "bg-gray-900 text-white",
      )}
    >
      {symbol.slice(0, 4)}
    </span>
  );
}

/**
 * One price alert: coin, which way and how far, and whether it fired.
 * Shared by the alerts page and the coin's alert dialog.
 */
export function PriceAlertRow({
  symbol,
  direction,
  target,
  hitAgo,
  href,
  onRemove,
  removeLabel,
  disabled,
}: {
  symbol: string;
  direction: "above" | "below";
  /** Already formatted, in the currency it was set in. */
  target: string;
  /** "2h ago" once it fired; null while it's waiting. */
  hitAgo: string | null | undefined;
  href?: string;
  onRemove: () => void;
  removeLabel: string;
  disabled?: boolean;
}) {
  const fired = hitAgo !== null && hitAgo !== undefined;
  const Arrow = direction === "above" ? ArrowUpRight : ArrowDownRight;

  const body = (
    <>
      <SymbolBadge symbol={symbol} muted={fired} />
      <span className="min-w-0">
        <span className={cn("flex items-center gap-1 text-sm font-semibold", fired ? "text-gray-500" : "text-gray-900")}>
          <span className="uppercase">{symbol}</span>
          <Arrow className={cn("h-3.5 w-3.5", direction === "above" ? "text-emerald-600" : "text-red-600")} aria-hidden="true" />
          <span className="truncate tabular-nums">
            {direction} {target}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          {fired ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
              Hit {hitAgo}
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" aria-hidden="true" />
              Waiting
            </>
          )}
        </span>
      </span>
    </>
  );

  return (
    <li className="flex items-center gap-3 py-2.5">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-80">
          {body}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel}
        title="Remove"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
