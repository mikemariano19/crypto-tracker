"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import CoinCombobox from "@/components/portfolio/CoinCombobox";
import Modal from "@/components/portfolio/Modal";
import { useCoinPrices } from "@/hooks/useCoinPrices";
import type { WalletActions } from "@/hooks/useWalletStore";
import type { AddMode, CoinPick } from "@/lib/wallet/actions";
import { formatAmount, formatMoney, formatPrice, holdingRow } from "@/lib/portfolio";
import type { Currency, Holding, Wallet } from "@/lib/wallet/schema";
import { Dec, MAX_AMOUNT_DECIMALS, addAmounts, parseAmount, parseBuyPrice } from "@/lib/wallet/validate";
import { cn } from "@/lib/utils";

export type HoldingFormTarget =
  | { kind: "add"; wallet: Wallet }
  | { kind: "edit"; wallet: Wallet; holding: Holding };

/**
 * Add a coin to a wallet, or change an amount. Shows the value live as the
 * amount is typed, and asks "add or replace" when the wallet already holds
 * the coin.
 */
export default function HoldingForm({
  target,
  currency,
  onClose,
  addHolding,
  updateHolding,
}: {
  target: HoldingFormTarget | null;
  currency: Currency;
  onClose: () => void;
  addHolding: WalletActions["addHolding"];
  updateHolding: WalletActions["updateHolding"];
}) {
  // While the coin list is open, Escape closes the list, not the dialog.
  const comboOpenRef = useRef(false);

  return (
    <Modal
      open={target !== null}
      onEscapeKeyDown={(event) => {
        if (comboOpenRef.current) event.preventDefault();
      }}
      onOpenChange={(open) => !open && onClose()}
      title={target?.kind === "edit" ? `Edit ${target.holding.symbol}` : `Add coin to ${target?.wallet.name ?? ""}`}
      description={target?.kind === "edit" ? `How much ${target.holding.name} is in ${target.wallet.name}?` : undefined}
    >
      {/* Keyed so each opening starts with a clean form. */}
      {target && (
        <HoldingFormBody
          key={target.kind === "edit" ? `${target.wallet.id}:${target.holding.coinId}` : target.wallet.id}
          target={target}
          currency={currency}
          onClose={onClose}
          addHolding={addHolding}
          updateHolding={updateHolding}
          comboOpenRef={comboOpenRef}
        />
      )}
    </Modal>
  );
}

function HoldingFormBody({
  target,
  currency,
  onClose,
  addHolding,
  updateHolding,
  comboOpenRef,
}: {
  target: HoldingFormTarget;
  currency: Currency;
  onClose: () => void;
  addHolding: WalletActions["addHolding"];
  updateHolding: WalletActions["updateHolding"];
  comboOpenRef: React.RefObject<boolean>;
}) {
  const editing = target.kind === "edit" ? target.holding : null;

  const [coin, setCoin] = useState<CoinPick | null>(
    editing ? { coinId: editing.coinId, symbol: editing.symbol, name: editing.name, image: editing.image } : null
  );
  const [amount, setAmount] = useState(editing?.amount ?? "");
  const [buyPrice, setBuyPrice] = useState(editing?.buyPrice?.price ?? "");
  const [mode, setMode] = useState<AddMode>("add");
  const [touched, setTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountId = useId();
  const priceId = useId();
  const amountRef = useRef<HTMLInputElement>(null);

  const { prices } = useCoinPrices(coin ? [coin.coinId] : []);

  const parsed = amount.trim() ? parseAmount(amount) : null;
  const existing = !editing && coin ? target.wallet.holdings.find((h) => h.coinId === coin.coinId) : undefined;
  // A coin keeps the currency its buy price was first entered in, so a
  // top-up can be averaged without guessing an exchange rate.
  const held = editing?.buyPrice ?? existing?.buyPrice;
  const priceCurrency: Currency = held?.currency ?? currency;
  const parsedPrice = parseBuyPrice(buyPrice);
  const marketPrice = coin ? prices[coin.coinId]?.[priceCurrency] ?? null : null;
  const finalAmount =
    parsed?.ok && existing && mode === "add" ? addAmounts(existing.amount, parsed.amount) : parsed?.ok ? parsed.amount : null;

  const preview =
    coin && finalAmount
      ? holdingRow({ ...coin, amount: finalAmount, updatedAt: "" }, prices[coin.coinId], currency).value
      : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);

    if (!coin) return setError("Pick a coin first.");
    if (!parsed?.ok) return setError(parsed?.error ?? "Enter an amount.");
    if (!parsedPrice.ok) return setPriceTouched(true);

    const price = { price: buyPrice, currency: priceCurrency };
    const failure = editing
      ? updateHolding(target.wallet.id, coin.coinId, amount, price)
      : addHolding(target.wallet.id, coin, amount, existing ? mode : "add", price);

    if (failure) return setError(failure);
    onClose();
  };

  // Wait for blur or submit before complaining, so "0." on the way to "0.5" isn't an error.
  const amountError = touched && parsed && !parsed.ok ? parsed.error : null;
  const priceError = priceTouched && !parsedPrice.ok ? parsedPrice.error : null;

  const priceHint =
    held && existing && mode === "add"
      ? `Leave blank to keep your average of ${formatPrice(new Dec(held.price), held.currency)}. A new price is averaged in.`
      : "What you paid per coin, on average. Optional; it’s used for profit and loss.";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {!coin ? (
        <CoinCombobox
          autoFocus
          onOpenChange={(open) => (comboOpenRef.current = open)}
          onSelect={(picked) => {
            setCoin({ coinId: picked.id, symbol: picked.symbol, name: picked.name, image: picked.image ?? undefined });
            setError(null);
            // The search box is about to disappear; carry focus to the amount.
            amountRef.current?.focus();
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
            {!editing && (
              <button
                type="button"
                onClick={() => setCoin(null)}
                className="ml-auto text-xs font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
              >
                Change
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <label htmlFor={amountId} className="mb-1.5 block text-sm font-medium text-gray-800">
          Amount
        </label>
        <input
          id={amountId}
          ref={amountRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={Boolean(editing)}
          placeholder="0.25"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(null);
          }}
          onBlur={() => amount.trim() && setTouched(true)}
          aria-invalid={Boolean(amountError)}
          aria-describedby={`${amountId}-hint`}
          className="h-10 w-full rounded-lg border bg-white px-3 text-sm tabular-nums outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 aria-invalid:border-red-400"
        />
        <p id={`${amountId}-hint`} className={cn("mt-1.5 text-sm", amountError ? "text-red-700" : "text-gray-600")}>
          {amountError ??
            (coin && finalAmount
              ? `${formatAmount(finalAmount)} ${coin.symbol.toUpperCase()} ≈ ${preview ? formatMoney(preview, currency) : "price loading…"}`
              : "Only the amount is needed. Never enter seed phrases or private keys.")}
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label htmlFor={priceId} className="text-sm font-medium text-gray-800">
            Buy price per coin <span className="font-normal text-gray-500">({priceCurrency.toUpperCase()}, optional)</span>
          </label>
          {marketPrice !== null && (
            <button
              type="button"
              onClick={() => {
                setBuyPrice(new Dec(String(marketPrice)).toDecimalPlaces(MAX_AMOUNT_DECIMALS).toFixed());
                setPriceTouched(false);
                setError(null);
              }}
              className="text-xs font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
            >
              Use current price
            </button>
          )}
        </div>
        <input
          id={priceId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={buyPrice}
          onChange={(event) => {
            setBuyPrice(event.target.value);
            setError(null);
          }}
          onBlur={() => buyPrice.trim() && setPriceTouched(true)}
          aria-invalid={Boolean(priceError)}
          aria-describedby={`${priceId}-hint`}
          className="h-10 w-full rounded-lg border bg-white px-3 text-sm tabular-nums outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 aria-invalid:border-red-400"
        />
        <p id={`${priceId}-hint`} className={cn("mt-1.5 text-sm", priceError ? "text-red-700" : "text-gray-600")}>
          {priceError ?? priceHint}
        </p>
      </div>

      {existing && (
        <fieldset className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium text-gray-800">
            You already have {formatAmount(existing.amount)} {existing.symbol} here
          </legend>
          {(["add", "replace"] as const).map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-gray-700">
              <input type="radio" name="mode" value={option} checked={mode === option} onChange={() => setMode(option)} />
              {option === "add"
                ? `Add to it${parsed?.ok ? ` (new total ${formatAmount(addAmounts(existing.amount, parsed.amount))})` : ""}`
                : `Replace it${parsed?.ok ? ` with ${formatAmount(parsed.amount)}` : ""}`}
            </label>
          ))}
        </fieldset>
      )}

      {error && error !== amountError && error !== priceError && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="lg">
          {editing ? "Save" : existing && mode === "replace" ? "Replace" : "Add coin"}
        </Button>
      </div>
    </form>
  );
}
