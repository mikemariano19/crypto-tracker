"use client";

import type Decimal from "decimal.js";
import { RefreshCw } from "lucide-react";
import AllocationBar from "@/components/portfolio/AllocationBar";
import ChangeText from "@/components/portfolio/ChangeText";
import CurrencyToggle from "@/components/portfolio/CurrencyToggle";
import { formatClock } from "@/components/portfolio/Notices";
import { formatMoney, type AllocationSlice, type PortfolioTotals } from "@/lib/portfolio";
import type { Currency } from "@/lib/wallet/schema";
import { cn } from "@/lib/utils";

/**
 * Portfolio total in the chosen currency (≈ the other one beside it), 24h
 * change, profit/loss where buy prices are set, price freshness and the
 * allocation bar. When wallets are
 * filtered, the shown wallets' total leads and the full total follows.
 */
export default function PortfolioSummary({
  totals,
  shown,
  otherCurrencyTotal,
  currency,
  selectedCurrency,
  onCurrencyChange,
  slices,
  pricesLoading,
  updatedAt,
  isRefreshing,
  onRefresh,
  announce,
}: {
  totals: PortfolioTotals;
  /** Totals of the wallets matching the search; null when not searching. */
  shown: PortfolioTotals | null;
  otherCurrencyTotal: Decimal;
  /** Currency the numbers are shown in (may lag the toggle for a moment). */
  currency: Currency;
  /** Currency picked on the toggle. */
  selectedCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  slices: AllocationSlice[];
  pricesLoading: boolean;
  updatedAt: number | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  /** Read totals aloud only after a manual refresh, not every minute. */
  announce: boolean;
}) {
  const other: Currency = currency === "usd" ? "php" : "usd";
  const lead = shown ?? totals;
  const missing = totals.missingCoins.length;
  const uncosted = lead.pnl?.uncostedCount ?? 0;

  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5" aria-labelledby="portfolio-total-label">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0" aria-live={announce ? "polite" : "off"} aria-atomic="true">
          <p id="portfolio-total-label" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {shown ? "Total of shown wallets" : "Portfolio total"}
          </p>

          {pricesLoading ? (
            <span className="mt-1 inline-block h-8 w-48 animate-pulse rounded bg-gray-200" aria-label="Loading prices" />
          ) : (
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-3xl">
                {formatMoney(lead.total, currency)}
              </span>
              {!shown && (
                <span className="text-sm tabular-nums text-muted-foreground">
                  ≈ {formatMoney(otherCurrencyTotal, other)}
                </span>
              )}
            </p>
          )}

          {shown && !pricesLoading && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Full portfolio: <span className="font-semibold tabular-nums text-gray-800">{formatMoney(totals.total, currency)}</span>
            </p>
          )}
        </div>

        <CurrencyToggle value={selectedCurrency} onChange={onCurrencyChange} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {!pricesLoading && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">24h</span>
            <ChangeText value={lead.change24h} pct={lead.change24hPct} currency={currency} />
          </span>
        )}
        {!pricesLoading && lead.pnl && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">Profit/loss</span>
            <ChangeText value={lead.pnl.pnl} pct={lead.pnl.pct} currency={currency} />
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {updatedAt !== null && <>Prices updated {formatClock(updatedAt)} ·</>}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded font-medium text-gray-700 hover:text-gray-900 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} aria-hidden="true" />
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </span>
        {missing > 0 && !pricesLoading && (
          <span className="text-xs text-muted-foreground">
            · {missing} {missing === 1 ? "coin" : "coins"} without price
          </span>
        )}
        {uncosted > 0 && !pricesLoading && (
          <span className="text-xs text-muted-foreground">
            · profit/loss leaves out {uncosted} {uncosted === 1 ? "holding" : "holdings"} with no buy price
          </span>
        )}
      </div>

      {slices.length > 0 && (
        <div className="mt-4">
          <AllocationBar slices={slices} currency={currency} />
        </div>
      )}
    </section>
  );
}
