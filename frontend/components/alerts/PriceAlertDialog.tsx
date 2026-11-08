"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BellRing, Settings2 } from "lucide-react";
import { PriceAlertRow } from "@/components/alerts/AlertParts";
import PushNotice from "@/components/alerts/PushNotice";
import Modal from "@/components/portfolio/Modal";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useNow } from "@/hooks/useNow";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { alertLabel, formatInCurrency } from "@/lib/alertFormat";
import { formatRelativeTime } from "@/lib/formatNews";
import { formatFiatPrice } from "@/lib/money";
import { alertDirection, parseAmount } from "@/lib/push";
import { cn } from "@/lib/utils";

export type AlertCoin = {
  id: string;
  name: string;
  symbol: string;
  /** Today's price, to start the form from and to pick the direction. */
  price: number | null;
  /** The currency `price` is in: USD on coin pages, the wallet's in the portfolio. */
  priceCurrency: string;
};

// One tap sets a target this far from today's price.
const QUICK_STEPS = [-10, -5, 5, 10];

/** A target `pct` away from today's price, rounded up to look like one. */
function roundedTarget(price: number | null, pct = 5): string {
  if (!price || price <= 0) return "";

  const step = 10 ** Math.max(Math.floor(Math.log10(price)) - 1, -8);
  const rounded = Math.ceil((price * (1 + pct / 100)) / step) * step;

  return String(Number(rounded.toPrecision(12)));
}

function pctText(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
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
  const now = useNow();

  const sourceRate = coin.priceCurrency === "usd" ? 1 : byCodeMap.get(coin.priceCurrency)?.per_usd;
  const usdPrice = coin.price !== null && sourceRate ? coin.price / sourceRate : null;
  const price = usdPrice === null ? null : usdPrice * money.rate;

  // Follows the price (and the currency, once rates load) until edited.
  const [edited, setEdited] = useState<string | null>(null);
  const input = edited ?? roundedTarget(price);
  const [touched, setTouched] = useState(false);
  // Without today's price the direction can't be worked out, so it's asked.
  const [chosenDirection, setChosenDirection] = useState<"above" | "below">("above");
  const inputId = useId();

  const symbol = coin.symbol.toUpperCase();
  const threshold = parseAmount(input);
  const direction = threshold === null ? null : price === null ? chosenDirection : alertDirection(threshold, price);
  const distance = threshold !== null && price ? ((threshold - price) / price) * 100 : null;
  const mine = (push.state?.alerts ?? []).filter((alert) => alert.coinId === coin.id);
  const canSet = push.status === "on" || push.status === "off";
  const invalid = touched && threshold === null;

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
          {usdPrice !== null && (
            <div className="flex items-baseline justify-between rounded-xl bg-gray-50 px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{symbol} now</span>
              <span className="text-lg font-bold tabular-nums text-gray-900">{formatFiatPrice(usdPrice, money)}</span>
            </div>
          )}

          <div>
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-gray-900">
              Target price ({code.toUpperCase()})
            </label>
            <div className="relative">
              <input
                id={inputId}
                inputMode="decimal"
                autoComplete="off"
                value={input}
                onChange={(event) => setEdited(event.target.value)}
                aria-invalid={invalid}
                aria-describedby={`${inputId}-hint`}
                className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-4 pr-14 text-lg font-semibold tabular-nums text-gray-900 outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 aria-invalid:border-red-400 aria-invalid:ring-red-100"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-gray-400">
                {code.toUpperCase()}
              </span>
            </div>

            {price !== null && (
              <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label="Quick targets">
                {QUICK_STEPS.map((step) => {
                  const value = roundedTarget(price, step);
                  const active = value === input;

                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setEdited(value)}
                      aria-pressed={active}
                      className={cn(
                        "h-8 rounded-lg border text-xs font-semibold tabular-nums transition-colors",
                        active
                          ? "border-gray-900 bg-gray-900 text-white"
                          : step < 0
                            ? "border-gray-200 bg-white text-red-600 hover:bg-red-50"
                            : "border-gray-200 bg-white text-emerald-700 hover:bg-emerald-50",
                      )}
                    >
                      {step > 0 ? `+${step}%` : `−${Math.abs(step)}%`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {price === null && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-gray-900">Alert when the price</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                {(["above", "below"] as const).map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gray-500",
                      chosenDirection === option ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`${inputId}-direction`}
                      checked={chosenDirection === option}
                      onChange={() => setChosenDirection(option)}
                    />
                    Goes {option}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <p
            id={`${inputId}-hint`}
            aria-live="polite"
            className={cn(
              "flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm",
              invalid
                ? "bg-red-50 text-red-700"
                : direction === "below"
                  ? "bg-red-50 text-red-800"
                  : direction === "above"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-gray-50 text-gray-600",
            )}
          >
            {invalid ? (
              "Enter a price above zero."
            ) : threshold !== null && direction !== null ? (
              <>
                {direction === "above" ? (
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>
                  Alert me when {symbol} goes {direction} {formatFiatPrice(threshold / money.rate, money)}
                  {distance !== null && <span className="ml-1 font-semibold tabular-nums">({pctText(distance)} from now)</span>}
                </span>
              </>
            ) : (
              "Type the price you want to hear about."
            )}
          </p>

          {mine.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Your alerts for {symbol}</p>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-3">
                {mine.map((alert) => (
                  <PriceAlertRow
                    key={alert.id}
                    symbol={alert.symbol}
                    direction={alert.direction}
                    target={formatInCurrency(alert.threshold, alert.currency, byCodeMap)}
                    hitAgo={alert.triggeredAt ? (now > 0 ? formatRelativeTime(alert.triggeredAt, now) : "") : null}
                    onRemove={() => push.removeAlert(alert.id)}
                    removeLabel={`Remove alert: ${alertLabel(alert, byCodeMap)}`}
                    disabled={push.busy}
                  />
                ))}
              </ul>
            </div>
          )}

          {push.error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{push.error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/alerts"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Alert settings
            </Link>
            <button
              type="submit"
              disabled={push.busy || push.status === "loading"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-60"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              {push.busy ? "Saving…" : "Alert me"}
            </button>
          </div>

          {push.status === "off" && (
            <p className="text-center text-xs text-gray-500 sm:text-left">
              Your browser will ask to allow notifications. Only the coin and price you pick are stored, with no account.
            </p>
          )}
        </form>
      ) : (
        <PushNotice status={push.status} />
      )}
    </Modal>
  );
}
