"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import CoinCombobox from "@/components/portfolio/CoinCombobox";
import Modal from "@/components/portfolio/Modal";
import { useAlerts } from "@/hooks/useAlerts";
import { useCoinPrices } from "@/hooks/useCoinPrices";
import { requestNotifications } from "@/hooks/useNotificationPermission";
import { isMet, type AlertCoin, type AlertCondition } from "@/lib/alerts";
import { formatPrice } from "@/lib/portfolio";
import type { Currency } from "@/lib/wallet/schema";
import { Dec, parseAmount } from "@/lib/wallet/validate";
import { cn } from "@/lib/utils";

/**
 * New price alert. With `coin` set (from a coin page) the coin is fixed;
 * otherwise it starts with the coin search.
 */
export default function AlertForm({
  open,
  coin,
  onClose,
}: {
  open: boolean;
  coin?: AlertCoin;
  onClose: () => void;
}) {
  // While the coin list is open, Escape closes the list, not the dialog.
  const comboOpenRef = useRef(false);

  return (
    <Modal
      open={open}
      onEscapeKeyDown={(event) => {
        if (comboOpenRef.current) event.preventDefault();
      }}
      onOpenChange={(next) => !next && onClose()}
      title={coin ? `Price alert for ${coin.name}` : "New price alert"}
      description="Checked about once a minute while this site is open in a tab."
    >
      {open && <AlertFormBody coin={coin} onClose={onClose} comboOpenRef={comboOpenRef} />}
    </Modal>
  );
}

function AlertFormBody({
  coin: fixedCoin,
  onClose,
  comboOpenRef,
}: {
  coin?: AlertCoin;
  onClose: () => void;
  comboOpenRef: React.RefObject<boolean>;
}) {
  const { addAlert } = useAlerts();
  const [coin, setCoin] = useState<AlertCoin | null>(fixedCoin ?? null);
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState<Currency>("usd");
  const [chosen, setChosen] = useState<AlertCondition | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetId = useId();
  const targetRef = useRef<HTMLInputElement>(null);

  const { prices } = useCoinPrices(coin ? [coin.coinId] : []);
  const now = coin ? prices[coin.coinId]?.[currency] ?? null : null;

  const parsed = target.trim() ? parseAmount(target, "Price") : null;
  // Until picked by hand, the direction follows the target: above today's price means "rises above".
  const guessed: AlertCondition = parsed?.ok && now !== null && new Dec(parsed.amount).lt(String(now)) ? "below" : "above";
  const condition = chosen ?? guessed;
  const alreadyMet = parsed?.ok && now !== null && isMet({ condition, target: parsed.amount }, now);

  const targetError = touched && parsed && !parsed.ok ? parsed.error : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);

    if (!coin) return setError("Pick a coin first.");
    if (!parsed?.ok) return setError(parsed?.error ?? "Enter a target price.");

    const failure = addAlert({ coin, condition, target, currency });
    if (failure) return setError(failure);

    // Still inside the click, so the browser will show its prompt.
    void requestNotifications();
    onClose();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {!coin ? (
        <CoinCombobox
          autoFocus
          onOpenChange={(isOpen) => (comboOpenRef.current = isOpen)}
          onSelect={(picked) => {
            setCoin({ coinId: picked.id, symbol: picked.symbol, name: picked.name, image: picked.image ?? undefined });
            setError(null);
            targetRef.current?.focus();
          }}
        />
      ) : (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-800">Coin</span>
          <div className="flex items-center gap-2.5 rounded-lg border bg-gray-50 px-3 py-2">
            {coin.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coin.image} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
            )}
            <span className="font-semibold text-gray-900">{coin.name}</span>
            <span className="text-xs font-semibold uppercase text-gray-500">{coin.symbol}</span>
            {now !== null && (
              <span className="ml-auto text-sm tabular-nums text-gray-600">{formatPrice(new Dec(String(now)), currency)}</span>
            )}
            {!fixedCoin && (
              <button
                type="button"
                onClick={() => setCoin(null)}
                className={cn(
                  "text-xs font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline",
                  now === null && "ml-auto"
                )}
              >
                Change
              </button>
            )}
          </div>
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-gray-800">Alert me when the price</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          {(["above", "below"] as const).map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-md py-1.5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-gray-500",
                condition === option ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              )}
            >
              <input
                type="radio"
                name="condition"
                value={option}
                checked={condition === option}
                onChange={() => setChosen(option)}
                className="sr-only"
              />
              {option === "above" ? "Rises above" : "Drops below"}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={targetId} className="mb-1.5 block text-sm font-medium text-gray-800">
          Target price
        </label>
        <div className="flex gap-2">
          <input
            id={targetId}
            ref={targetRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={Boolean(fixedCoin)}
            placeholder={now !== null ? new Dec(String(now)).toSignificantDigits(6).toFixed() : "0.00"}
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setError(null);
            }}
            onBlur={() => target.trim() && setTouched(true)}
            aria-invalid={Boolean(targetError)}
            aria-describedby={`${targetId}-hint`}
            className="h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm tabular-nums outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 aria-invalid:border-red-400"
          />
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            aria-label="Currency"
            className="h-10 rounded-lg border bg-white px-2 text-sm font-medium text-gray-800"
          >
            <option value="usd">USD</option>
            <option value="php">PHP</option>
          </select>
        </div>
        <p id={`${targetId}-hint`} className={cn("mt-1.5 text-sm", targetError ? "text-red-700" : "text-gray-600")}>
          {targetError ??
            (alreadyMet
              ? `${coin?.symbol.toUpperCase()} is already ${condition} that, so this alert will go off right away.`
              : "You’ll get one notification when it crosses, then the alert pauses until you re-arm it.")}
        </p>
      </div>

      {error && error !== targetError && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="lg">
          Create alert
        </Button>
      </div>
    </form>
  );
}
