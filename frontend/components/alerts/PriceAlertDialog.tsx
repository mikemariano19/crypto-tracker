"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { BellRing, Trash2 } from "lucide-react";
import PushNotice from "@/components/alerts/PushNotice";
import Modal from "@/components/portfolio/Modal";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { alertLabel } from "@/lib/alertFormat";
import { formatFiatPrice } from "@/lib/money";
import { alertDirection, parseAmount } from "@/lib/push";

export type AlertCoin = {
  id: string;
  name: string;
  symbol: string;
  /** Today's price, to start the form from and to pick the direction. */
  price: number | null;
  /** The currency `price` is in: USD on coin pages, the wallet's in the portfolio. */
  priceCurrency: string;
};

/** A starting target close to today's price, rounded to look like one. */
function startingTarget(price: number | null): string {
  if (!price || price <= 0) return "";

  const step = 10 ** Math.max(Math.floor(Math.log10(price)) - 1, -8);
  const rounded = Math.ceil((price * 1.05) / step) * step;

  return String(Number(rounded.toPrecision(12)));
}

/**
 * Set a price alert for one coin, in the display currency. The first one is
 * what asks the browser for permission, never a page load.
 */
export default function PriceAlertDialog({
  open,
  onOpenChange,
  coin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coin: AlertCoin;
}) {
  const { money, code } = useDisplayCurrency();
  const { byCode: byCodeMap } = useExchangeRates();
  const push = usePushAlerts(code);

  const sourceRate = coin.priceCurrency === "usd" ? 1 : byCodeMap.get(coin.priceCurrency)?.per_usd;
  const usdPrice = coin.price !== null && sourceRate ? coin.price / sourceRate : null;
  const price = usdPrice === null ? null : usdPrice * money.rate;

  // Follows the price (and the currency, once rates load) until edited.
  const [edited, setEdited] = useState<string | null>(null);
  const input = edited ?? startingTarget(price);
  const setInput = setEdited;
  const [touched, setTouched] = useState(false);
  // Without today's price the direction can't be worked out, so it's asked.
  const [chosenDirection, setChosenDirection] = useState<"above" | "below">("above");
  const inputId = useId();

  const threshold = parseAmount(input);
  const direction = threshold === null ? null : price === null ? chosenDirection : alertDirection(threshold, price);
  const mine = (push.state?.alerts ?? []).filter((alert) => alert.coinId === coin.id);
  const canSet = push.status === "on" || push.status === "off";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);

    if (threshold === null || direction === null) return;

    const saved = await push.addAlert({ coinId: coin.id, symbol: coin.symbol, direction, threshold, currency: code });

    if (saved) onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Price alert for ${coin.name}`} description="Get a notification when the price gets there.">
      {canSet || push.status === "loading" ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-800">
              Target price ({code.toUpperCase()})
            </label>
            <input
              id={inputId}
              inputMode="decimal"
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={touched && threshold === null}
              aria-describedby={`${inputId}-hint`}
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm tabular-nums outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 aria-invalid:border-red-400"
            />
            <p id={`${inputId}-hint`} className={touched && threshold === null ? "mt-1.5 text-sm text-red-700" : "mt-1.5 text-sm text-gray-600"}>
              {touched && threshold === null
                ? "Enter a price above zero."
                : threshold !== null && direction !== null
                  ? `Alert me when ${coin.symbol.toUpperCase()} goes ${direction} ${formatFiatPrice(threshold / money.rate, money)}.`
                  : " "}
              {price !== null && <span className="block text-xs text-gray-500">Now {formatFiatPrice(usdPrice, money)}</span>}
            </p>
          </div>

          {price === null && (
            <fieldset className="flex gap-4 text-sm text-gray-700">
              <legend className="sr-only">Alert when the price goes</legend>
              {(["above", "below"] as const).map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name={`${inputId}-direction`} checked={chosenDirection === option} onChange={() => setChosenDirection(option)} />
                  Goes {option}
                </label>
              ))}
            </fieldset>
          )}

          {mine.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Your alerts for {coin.symbol.toUpperCase()}</p>
              <ul className="divide-y rounded-lg border">
                {mine.map((alert) => (
                  <li key={alert.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className={alert.triggeredAt ? "text-gray-500" : "text-gray-900"}>
                      {alertLabel(alert, byCodeMap)}
                      {alert.triggeredAt && <span className="ml-1.5 text-xs">(hit)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => push.removeAlert(alert.id)}
                      disabled={push.busy}
                      aria-label={`Remove alert: ${alertLabel(alert, byCodeMap)}`}
                      className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {push.error && <p role="alert" className="text-sm text-red-700">{push.error}</p>}

          <div className="flex items-center justify-between gap-2">
            <Link href="/alerts" className="text-xs font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
              Alert settings
            </Link>
            <button
              type="submit"
              disabled={push.busy || push.status === "loading"}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              {push.busy ? "Saving…" : "Alert me"}
            </button>
          </div>

          {push.status === "off" && (
            <p className="text-xs text-gray-500">Your browser will ask to allow notifications. Only the coin and price you pick are stored, with no account.</p>
          )}
        </form>
      ) : (
        <PushNotice status={push.status} />
      )}
    </Modal>
  );
}

