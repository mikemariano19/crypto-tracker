"use client";

import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import AlertForm from "@/components/alerts/AlertForm";
import { useAlerts } from "@/hooks/useAlerts";
import type { AlertCoin } from "@/lib/alerts";

/** Bell next to a coin's favorite star: opens a new alert for that coin. */
export default function AlertButton({ coin }: { coin: AlertCoin }) {
  const { alerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const armed = alerts.filter((alert) => alert.coinId === coin.coinId && !alert.triggered).length;
  const Icon = armed > 0 ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={armed > 0 ? `Add a price alert for ${coin.name} (${armed} active)` : `Add a price alert for ${coin.name}`}
        title="Price alert"
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-white transition-colors hover:bg-gray-100"
      >
        <Icon className={armed > 0 ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-gray-400"} aria-hidden="true" />
        {armed > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white" aria-hidden="true">
            {armed}
          </span>
        )}
      </button>
      <AlertForm open={open} coin={coin} onClose={() => setOpen(false)} />
    </>
  );
}
