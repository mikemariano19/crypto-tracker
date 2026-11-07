"use client";

import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import PriceAlertDialog, { type AlertCoin } from "@/components/alerts/PriceAlertDialog";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { cn } from "@/lib/utils";

/**
 * Bell next to a coin. Lit when this browser has an alert waiting on it.
 * Safe inside clickable rows: the click doesn't reach the row.
 */
export default function AlertButton({ coin, size = "md", className }: { coin: AlertCoin; size?: "sm" | "md"; className?: string }) {
  const [open, setOpen] = useState(false);
  const { code } = useDisplayCurrency();
  const { state } = usePushAlerts(code);
  const waiting = (state?.alerts ?? []).some((alert) => alert.coinId === coin.id && !alert.triggeredAt);
  const Icon = waiting ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        aria-label={waiting ? `Price alerts for ${coin.name} (set)` : `Set a price alert for ${coin.name}`}
        title={waiting ? "You have an alert on this coin" : "Alert me"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-gray-100",
          size === "sm" ? "h-6 w-6" : "h-9 w-9 border bg-white",
          className,
        )}
      >
        <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", waiting ? "text-gray-900" : "text-gray-400")} aria-hidden="true" />
      </button>

      {/* Mounted only while open, so the form starts from today's price. */}
      {open && <PriceAlertDialog open={open} onOpenChange={setOpen} coin={coin} />}
    </>
  );
}
