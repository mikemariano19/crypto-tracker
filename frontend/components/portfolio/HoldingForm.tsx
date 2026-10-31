"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import CoinCombobox from "@/components/portfolio/CoinCombobox";
import Modal from "@/components/portfolio/Modal";
import { useCoinPrices } from "@/hooks/useCoinPrices";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import type { WalletActions } from "@/hooks/useWalletStore";
import type { AddMode, CoinPick } from "@/lib/wallet/actions";
import { formatAmount, formatMoney, holdingRow } from "@/lib/portfolio";
import type { Currency, Holding, Wallet } from "@/lib/wallet/schema";
import { addAmounts, parseAmount } from "@/lib/wallet/validate";
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
  const [mode, setMode] = useState<AddMode>("add");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountId = useId();
  const amountRef = useRef<HTMLInputElement>(null);

  const { prices } = useCoinPrices(coin ? [coin.coinId] : []);
  const { byCode } = useExchangeRates();
  const rate = byCode.get(currency)?.per_usd;

  const parsed = amount.trim() ? parseAmount(amount) : null;
  const existing = !editing && coin ? target.wallet.holdings.find((h) => h.coinId === coin.coinId) : undefined;
  const finalAmount =
    parsed?.ok && existing && mode === "add" ? addAmounts(existing.amount, parsed.amount) : parsed?.ok ? parsed.amount : null;

  const preview =
    coin && finalAmount
      ? holdingRow({ ...coin, amount: finalAmount, updatedAt: "" }, prices[coin.coinId], currency, rate ? { [currency]: rate } : undefined).value
      : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);

    if (!coin) return setError("Pick a coin first.");
    if (!parsed?.ok) return setError(parsed?.error ?? "Enter an amount.");

    const failure = editing
      ? updateHolding(target.wallet.id, coin.coinId, amount)
      : addHolding(target.wallet.id, coin, amount, existing ? mode : "add");

    if (failure) return setError(failure);
    onClose();
  };

  // Wait for blur or submit before complaining, so "0." on the way to "0.5" isn't an error.
  const amountError = touched && parsed && !parsed.ok ? parsed.error : null;

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

      {error && error !== amountError && (
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
