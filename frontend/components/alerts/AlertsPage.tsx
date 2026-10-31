"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, BellOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import AlertForm from "@/components/alerts/AlertForm";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/hooks/useAlerts";
import { useCoinPrices } from "@/hooks/useCoinPrices";
import { requestNotifications, useNotificationPermission } from "@/hooks/useNotificationPermission";
import { conditionText, type PriceAlert } from "@/lib/alerts";
import type { PriceMap } from "@/lib/wallet/prices";
import { formatPrice, formatSignedPercent } from "@/lib/portfolio";
import { Dec } from "@/lib/wallet/validate";

const dateTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function NotificationNotice() {
  const permission = useNotificationPermission();

  if (permission === "granted") return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="flex items-center gap-2">
        <BellOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        {permission === "default"
          ? "Turn on notifications to hear about alerts while you’re in another tab or app."
          : permission === "denied"
            ? "Notifications are blocked for this site in your browser settings. Alerts will still pop up here while the site is open."
            : "This browser can’t show notifications. Alerts will still pop up here while the site is open."}
      </p>
      {permission === "default" && (
        <Button size="sm" variant="outline" onClick={() => void requestNotifications()}>
          Turn on
        </Button>
      )}
    </div>
  );
}

function AlertRow({ alert, prices, onRemove, onRearm }: { alert: PriceAlert; prices: PriceMap; onRemove: () => void; onRearm: () => void }) {
  const now = prices[alert.coinId]?.[alert.currency] ?? null;
  // How far the price still has to move, relative to today's price.
  const away = now ? new Dec(alert.target).minus(String(now)).div(String(now)).times(100) : null;

  return (
    <li className="flex items-center gap-3 py-3">
      {alert.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={alert.image} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 shrink-0 rounded-full" />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600" aria-hidden="true">
          {alert.symbol.charAt(0)}
        </span>
      )}

      <div className="min-w-0 flex-1 text-sm">
        <p className="text-gray-900">
          <Link href={`/coin/${alert.coinId}`} className="font-semibold hover:underline">
            {alert.symbol}
          </Link>{" "}
          {conditionText(alert.condition)}{" "}
          <span className="font-semibold tabular-nums">{formatPrice(new Dec(alert.target), alert.currency)}</span>
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {alert.triggered
            ? `Hit ${formatPrice(new Dec(String(alert.triggered.price)), alert.currency)} on ${dateTime.format(new Date(alert.triggered.at))}`
            : now !== null && away !== null
              ? `Now ${formatPrice(new Dec(String(now)), alert.currency)} · ${formatSignedPercent(away)} to go`
              : "Waiting for a price…"}
        </p>
      </div>

      <div className="flex shrink-0 gap-0.5">
        {alert.triggered && (
          <button
            type="button"
            onClick={onRearm}
            aria-label={`Re-arm ${alert.symbol} alert`}
            title="Re-arm"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${alert.symbol} alert`}
          title="Delete"
          className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export default function AlertsPage() {
  const { alerts, removeAlert, rearmAlert, clearTriggered } = useAlerts();
  const [creating, setCreating] = useState(false);

  const armed = useMemo(() => alerts.filter((alert) => !alert.triggered), [alerts]);
  const triggered = useMemo(
    () => alerts.filter((alert) => alert.triggered).sort((a, b) => Date.parse(b.triggered!.at) - Date.parse(a.triggered!.at)),
    [alerts]
  );
  const { prices } = useCoinPrices(alerts.map((alert) => alert.coinId));

  const row = (alert: PriceAlert) => (
    <AlertRow key={alert.id} alert={alert} prices={prices} onRemove={() => removeAlert(alert.id)} onRearm={() => rearmAlert(alert.id)} />
  );

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Price alerts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Checked about once a minute while this site is open. Saved only in this browser.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> New alert
        </Button>
      </div>

      {alerts.length > 0 && <NotificationNotice />}

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-white px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-gray-900">No alerts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Pick a coin and a price, and you’ll hear about it when it gets there.</p>
          </div>
          <Button variant="outline" onClick={() => setCreating(true)}>
            Create your first alert
          </Button>
        </div>
      ) : (
        <>
          <section className="rounded-xl border bg-white px-4 shadow-sm" aria-labelledby="armed-heading">
            <h2 id="armed-heading" className="border-b py-3 text-sm font-semibold text-gray-900">
              Active <span className="font-normal text-muted-foreground">({armed.length})</span>
            </h2>
            {armed.length > 0 ? (
              <ul className="divide-y">{armed.map(row)}</ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">Nothing being watched right now.</p>
            )}
          </section>

          {triggered.length > 0 && (
            <section className="rounded-xl border bg-white px-4 shadow-sm" aria-labelledby="triggered-heading">
              <div className="flex items-center justify-between border-b py-3">
                <h2 id="triggered-heading" className="text-sm font-semibold text-gray-900">
                  Went off <span className="font-normal text-muted-foreground">({triggered.length})</span>
                </h2>
                <button type="button" onClick={clearTriggered} className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline">
                  Clear all
                </button>
              </div>
              <ul className="divide-y">{triggered.map(row)}</ul>
            </section>
          )}
        </>
      )}

      <AlertForm open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
