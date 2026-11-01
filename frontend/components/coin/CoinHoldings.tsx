"use client";

import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCoinPrices } from "@/hooks/useCoinPrices";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useWalletStore } from "@/hooks/useWalletStore";
import { formatAmount, formatMoney, holdingRow } from "@/lib/portfolio";
import { Dec } from "@/lib/wallet/validate";

/**
 * How much of this coin the Portfolio page holds, across wallets, valued
 * in the portfolio's currency. Read from this browser's saved wallets.
 */
export default function CoinHoldings({ coinId, symbol }: { coinId: string; symbol: string }) {
  const { state } = useWalletStore();
  const holdings = (state?.wallets ?? []).flatMap((wallet) =>
    wallet.holdings.filter((holding) => holding.coinId === coinId).map((holding) => ({ wallet: wallet.name, id: wallet.id, amount: holding.amount }))
  );

  const { prices } = useCoinPrices(holdings.length > 0 ? [coinId] : []);
  const { byCode } = useExchangeRates();

  // Saved wallets load right after hydration; render nothing until then.
  if (!state) return null;

  const currency = state.currency;
  const total = holdings.reduce((sum, holding) => sum.plus(holding.amount), new Dec(0));
  const rate = byCode.get(currency)?.per_usd;
  // Same pricing as the Portfolio page, so both show the same value.
  const value = holdingRow(
    { coinId, symbol, name: symbol, amount: total.toFixed(), updatedAt: "" },
    prices[coinId],
    currency,
    rate ? { [currency]: rate } : undefined
  ).value;
  const sym = symbol.toUpperCase();

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          In your portfolio
        </CardTitle>
      </CardHeader>

      <CardContent>
        {holdings.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">You don’t have any {sym} in your wallets.</p>
            <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline">
              Add it on the Portfolio page
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {value === null ? "—" : formatMoney(value, currency)}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {formatAmount(total.toFixed())} {sym}
              </p>
            </div>

            {holdings.length > 1 && (
              <ul className="divide-y rounded-lg border text-sm">
                {holdings.map((holding) => (
                  <li key={holding.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate text-gray-700">{holding.wallet}</span>
                    <span className="shrink-0 tabular-nums text-gray-900">
                      {formatAmount(holding.amount)} {sym}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline">
              {holdings.length === 1 ? `In ${holdings[0].wallet} · ` : ""}Open portfolio
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
