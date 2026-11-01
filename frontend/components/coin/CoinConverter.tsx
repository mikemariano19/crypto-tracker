"use client";

import { useId, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import CurrencyPicker from "@/components/coin/CurrencyPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { currencyDigits } from "@/lib/money";
import { Dec } from "@/lib/wallet/validate";

type Decimal = InstanceType<typeof Dec>;

/** Text in an amount box as a number ≥ 0, or null while it isn't one yet. */
function readAmount(text: string) {
  const clean = text.replace(/[\s,]/g, "");
  if (!/^\d*\.?\d*$/.test(clean) || clean === "" || clean === ".") return null;
  return new Dec(clean.startsWith(".") ? `0${clean}` : clean);
}

/** Fiat: the currency's own decimals from 1 up, else 6 significant digits so tiny prices don't show as 0. */
function fiatText(value: Decimal, digits: number) {
  return value.gte(1) ? value.toFixed(digits) : value.toSignificantDigits(6).toFixed();
}

/** Coin amounts: up to 8 decimals, trailing zeros dropped. */
function coinText(value: Decimal) {
  return value.toDecimalPlaces(8).toFixed();
}

/**
 * Coin ↔ fiat calculator in any of ~80 currencies. Type in either box; the
 * other follows at the current price (USD price × that currency's rate).
 * Its currency is the page's display currency, so changing one changes both.
 */
export default function CoinConverter({ symbol, usdPrice }: { symbol: string; usdPrice: number | null }) {
  const { code: currency, money, info, currencies, setCurrency } = useDisplayCurrency();

  const [coinAmount, setCoinAmount] = useState("1");
  const [fiatAmount, setFiatAmount] = useState("");
  // The box the user typed in last drives the other one.
  const [driver, setDriver] = useState<"coin" | "fiat">("coin");
  const coinInputId = useId();
  const fiatInputId = useId();

  // Until the rates arrive, `money` is still USD: wait rather than mislabel.
  const ready = money.code === currency;
  const priceDec = usdPrice && ready ? new Dec(String(usdPrice)).times(String(money.rate)) : null;
  const digits = currencyDigits(currency);
  const unit = info?.unit ?? (currency === "usd" ? "$" : currency.toUpperCase());

  const typedCoin = readAmount(coinAmount);
  const typedFiat = readAmount(fiatAmount);

  const coinValue = driver === "coin" ? coinAmount : priceDec && typedFiat ? coinText(typedFiat.div(priceDec)) : "";
  const fiatValue = driver === "fiat" ? fiatAmount : priceDec && typedCoin ? fiatText(typedCoin.times(priceDec), digits) : "";

  const inputClass =
    "h-11 w-full min-w-0 rounded-lg border bg-white pl-3 pr-16 text-base tabular-nums outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200";
  const unitClass = "pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-muted-foreground";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Converter
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <label htmlFor={coinInputId} className="sr-only">
          Amount in {symbol.toUpperCase()}
        </label>
        <div className="relative">
          <input
            id={coinInputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={coinValue}
            onChange={(event) => {
              setCoinAmount(event.target.value);
              setDriver("coin");
            }}
            className={inputClass}
          />
          <span className={unitClass}>{symbol.toUpperCase()}</span>
        </div>

        <label htmlFor={fiatInputId} className="sr-only">
          Amount in {info?.name ?? currency.toUpperCase()}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id={fiatInputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={priceDec === null ? "Loading price…" : undefined}
              value={fiatValue}
              onChange={(event) => {
                setFiatAmount(event.target.value);
                setDriver("fiat");
              }}
              className={inputClass}
            />
            <span className={unitClass}>{unit}</span>
          </div>
          <CurrencyPicker
            currencies={currencies}
            value={currency}
            onChange={(code) => {
              // Keep the coin amount and re-price it in the new currency.
              if (driver === "fiat") setCoinAmount(coinValue);
              setDriver("coin");
              setCurrency(code);
            }}
          />
        </div>

        <p className="pt-1 text-xs text-muted-foreground tabular-nums">
          {priceDec
            ? `1 ${symbol.toUpperCase()} = ${fiatText(priceDec, digits)} ${currency.toUpperCase()}${info && currency !== "usd" ? ` · ${info.name}` : ""}`
            : "Waiting for a price…"}
        </p>
      </CardContent>
    </Card>
  );
}
