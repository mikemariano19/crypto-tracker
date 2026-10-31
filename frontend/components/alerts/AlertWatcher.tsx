"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useAlerts } from "@/hooks/useAlerts";
import { useCoinPrices } from "@/hooks/useCoinPrices";
import { conditionText, dueAlerts, type AlertHit } from "@/lib/alerts";
import { formatPrice } from "@/lib/portfolio";
import { Dec } from "@/lib/wallet/validate";

const MAX_TOASTS = 3;

export function hitTitle({ alert }: AlertHit): string {
  return `${alert.symbol} ${conditionText(alert.condition)} ${formatPrice(new Dec(alert.target), alert.currency)}`;
}

export function hitBody({ alert, price }: AlertHit): string {
  return `${alert.name} is now ${formatPrice(new Dec(String(price)), alert.currency)}`;
}

/** A system notification, when allowed. The tag stops two open tabs showing it twice. */
function notify(hit: AlertHit, open: (coinId: string) => void) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(hitTitle(hit), {
      body: hitBody(hit),
      icon: hit.alert.image,
      tag: `price-alert-${hit.alert.id}`,
    });
    notification.onclick = () => {
      window.focus();
      open(hit.alert.coinId);
      notification.close();
    };
  } catch {
    // Mobile Chrome only allows notifications from a service worker; the toast still shows.
  }
}

/**
 * Checks armed price alerts against prices (refreshed every minute) on
 * every page, fires each one once, and shows what fired as toasts.
 */
export default function AlertWatcher() {
  const router = useRouter();
  const { alerts, markTriggered } = useAlerts();
  const [toasts, setToasts] = useState<AlertHit[]>([]);

  const armedCoins = useMemo(() => alerts.filter((alert) => !alert.triggered).map((alert) => alert.coinId), [alerts]);
  const { prices } = useCoinPrices(armedCoins);

  useEffect(() => {
    const hits = markTriggered(dueAlerts(alerts, prices, Date.now()));
    if (hits.length === 0) return;

    for (const hit of hits) notify(hit, (coinId) => router.push(`/coin/${coinId}`));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- toasts come from an outside event (a price crossing a target)
    setToasts((shown) => [...hits, ...shown].slice(0, MAX_TOASTS));
  }, [alerts, prices, markTriggered, router]);

  const dismiss = (id: string) => setToasts((shown) => shown.filter((hit) => hit.alert.id !== id));

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-88"
    >
      {toasts.map((hit) => (
        <div
          key={hit.alert.id}
          role="status"
          className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-white p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <BellRing className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-gray-900">{hitTitle(hit)}</p>
            <p className="mt-0.5 text-gray-600">{hitBody(hit)}</p>
            <p className="mt-1.5 flex gap-3 text-xs font-medium">
              <Link href={`/coin/${hit.alert.coinId}`} onClick={() => dismiss(hit.alert.id)} className="text-gray-900 underline-offset-2 hover:underline">
                View {hit.alert.symbol}
              </Link>
              <Link href="/alerts" onClick={() => dismiss(hit.alert.id)} className="text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
                All alerts
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(hit.alert.id)}
            aria-label="Dismiss"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
