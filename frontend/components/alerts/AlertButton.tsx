"use client";

import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import PriceAlertDialog, { type AlertCoin } from "@/components/alerts/PriceAlertDialog";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { cn } from "@/lib/utils";

/**
 * Bell next to a coin. Amber when this browser has an alert waiting on it.
 * The page-header size says "Alert" in words; the row size is icon only.
 * Safe inside clickable rows: the click doesn't reach the row.
 */
export default function AlertButton({ coin, size = "md", className }: { coin: AlertCoin; size?: "sm" | "md"; className?: string }) {
  const [open, setOpen] = useState(false);
  const { code } = useDisplayCurrency();
  const { state } = usePushAlerts(code);
  const waiting = (state?.alerts ?? []).filter((alert) => alert.coinId === coin.id && !alert.triggeredAt).length;
  const Icon = waiting > 0 ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        aria-label={waiting > 0 ? `Price alerts for ${coin.name} (${waiting} set)` : `Set a price alert for ${coin.name}`}
        title={waiting > 0 ? "You have an alert on this coin" : "Alert me at a price"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition-colors",
          size === "sm"
            ? cn("h-6 w-6 rounded-md", waiting > 0 ? "text-amber-500 hover:bg-amber-50" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900")
            : cn(
                "h-9 gap-1.5 rounded-lg border px-2.5 text-sm font-medium sm:px-3",
                waiting > 0
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
              ),
          className,
        )}
      >
        <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", waiting > 0 && "fill-amber-400/30")} aria-hidden="true" />
        {size === "md" && (
          <span className="hidden sm:inline">
            {waiting > 0 ? (waiting === 1 ? "Alert set" : `${waiting} alerts`) : "Alert"}
          </span>
        )}
      </button>

      {/* Mounted only while open, so the form starts from today's price. */}
      {open && <PriceAlertDialog open={open} onOpenChange={setOpen} coin={coin} />}
    </>
  );
}
