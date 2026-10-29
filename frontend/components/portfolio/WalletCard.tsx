"use client";

import { memo, useId } from "react";
import { DropdownMenu } from "radix-ui";
import { ArrowDownUp, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SourceMark from "@/components/news/SourceMark";
import ChangeText from "@/components/portfolio/ChangeText";
import HoldingsTable, { HOLDING_SORT_LABELS } from "@/components/portfolio/HoldingsTable";
import { formatMoney, splitMatch, type WalletSummary } from "@/lib/portfolio";
import type { WalletProvider } from "@/lib/wallet/providers";
import type { Currency, HoldingSort } from "@/lib/wallet/schema";
import { cn } from "@/lib/utils";

export type WalletCardHandlers = {
  onToggle: (walletId: string, collapsed: boolean) => void;
  onSortHoldings: (walletId: string, sort: HoldingSort) => void;
  onAddCoin: (walletId: string) => void;
  onEditCoin: (walletId: string, coinId: string) => void;
  onRemoveCoin: (walletId: string, coinId: string) => void;
  onRename: (walletId: string) => void;
  onDelete: (walletId: string) => void;
};

type Props = WalletCardHandlers & {
  summary: WalletSummary;
  currency: Currency;
  query: string;
  pricesLoading: boolean;
  /** Exchange/wallet the wallet is at, for its logo. */
  provider: WalletProvider | null;
};

function Highlighted({ text, query }: { text: string; query: string }) {
  const [before, match, after] = splitMatch(text, query);
  if (!match) return <>{text}</>;

  return (
    <>
      {before}
      <mark className="rounded-sm bg-amber-200 px-0.5 text-inherit">{match}</mark>
      {after}
    </>
  );
}

/**
 * One wallet: a collapsible header with its total, and its coins inside.
 * Memoized, so a price refresh only redraws wallets whose numbers changed.
 */
function WalletCard({ summary, currency, query, pricesLoading, provider, ...on }: Props) {
  const { wallet, rows, total, change24h, missingCount } = summary;
  const bodyId = useId();
  const open = !wallet.collapsed;
  const hasCoins = rows.length > 0;
  const before = total.minus(change24h);
  const changePct = hasCoins && before.gt(0) ? change24h.div(before).times(100) : null;

  return (
    // content-visibility lets the browser skip layout and paint for cards
    // scrolled out of view, which matters with dozens of big wallets.
    <section
      className="rounded-xl border bg-white shadow-sm [contain-intrinsic-size:auto_480px] [content-visibility:auto]"
      aria-label={`Wallet ${wallet.name}`}
    >
      <header className="flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => on.onToggle(wallet.id, open)}
          aria-expanded={open}
          // The body is only rendered while open.
          aria-controls={open ? bodyId : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
        >
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 text-gray-500 transition-transform", open && "rotate-90")}
            aria-hidden="true"
          />
          {/* Provider logo, or the name's initial for custom wallets */}
          <SourceMark
            name={wallet.name}
            iconUrl={provider?.image ?? null}
            className="h-8 w-8 rounded-lg text-sm ring-1 ring-black/5"
          />
          <span className="min-w-0">
            <span className="block truncate font-bold text-gray-900">
              <Highlighted text={wallet.name} query={query} />
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "coin" : "coins"}
              {wallet.note && <> · {wallet.note}</>}
            </span>
          </span>
        </button>

        <div className="shrink-0 text-right">
          <div className="font-bold tabular-nums text-gray-900">
            {pricesLoading && hasCoins && total.isZero() ? (
              <span className="inline-block h-4 w-20 animate-pulse rounded bg-gray-200" aria-label="Loading" />
            ) : (
              formatMoney(total, currency)
            )}
          </div>
          {changePct && <ChangeText pct={changePct} className="text-xs" />}
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={`${wallet.name} options`}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 data-[state=open]:bg-gray-100"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-40 rounded-lg border bg-white p-1 shadow-lg">
              <DropdownMenu.Item
                onSelect={() => on.onRename(wallet.id)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-highlighted:bg-gray-100"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Rename or edit note
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => on.onDelete(wallet.id)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-red-700 outline-none data-highlighted:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete wallet
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      {open && (
        <div id={bodyId} className="border-t px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
          {!hasCoins ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-muted-foreground">No coins in this wallet yet.</p>
              <Button onClick={() => on.onAddCoin(wallet.id)} size="lg">
                <Plus aria-hidden="true" /> Add your first coin
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between gap-2">
                {/* Phones have no column headers, so sorting lives in a select */}
                <label className="flex items-center gap-1.5 text-xs text-gray-600 sm:invisible">
                  <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">Sort coins by</span>
                  <select
                    value={`${wallet.holdingSort.by}:${wallet.holdingSort.dir}`}
                    onChange={(event) => {
                      const [by, dir] = event.target.value.split(":") as [HoldingSort["by"], HoldingSort["dir"]];
                      on.onSortHoldings(wallet.id, { by, dir });
                    }}
                    className="rounded-md border bg-white px-1.5 py-1 text-xs"
                  >
                    {(Object.keys(HOLDING_SORT_LABELS) as HoldingSort["by"][]).flatMap((by) =>
                      (["desc", "asc"] as const).map((dir) => (
                        <option key={`${by}:${dir}`} value={`${by}:${dir}`}>
                          {HOLDING_SORT_LABELS[by]} {sortDirLabel(by, dir)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <Button variant="outline" size="sm" onClick={() => on.onAddCoin(wallet.id)}>
                  <Plus aria-hidden="true" /> Add coin
                </Button>
              </div>

              <HoldingsTable
                rows={rows}
                currency={currency}
                sort={wallet.holdingSort}
                pricesLoading={pricesLoading}
                onSort={(sort) => on.onSortHoldings(wallet.id, sort)}
                onEdit={(coinId) => on.onEditCoin(wallet.id, coinId)}
                onRemove={(coinId) => on.onRemoveCoin(wallet.id, coinId)}
              />

              {missingCount > 0 && !pricesLoading && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {missingCount} {missingCount === 1 ? "coin" : "coins"} without price, not included in the total.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function sortDirLabel(by: HoldingSort["by"], dir: HoldingSort["dir"]): string {
  if (by === "name") return dir === "asc" ? "(A–Z)" : "(Z–A)";
  return dir === "desc" ? "(high → low)" : "(low → high)";
}

export default memo(WalletCard);
