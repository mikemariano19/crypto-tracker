"use client";

import { DropdownMenu } from "radix-ui";
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import ChangeText from "@/components/portfolio/ChangeText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { amountIsShortened, formatAmount, formatMoney, formatPrice, formatSignedMoney, type HoldingRow } from "@/lib/portfolio";
import type { Currency, HoldingSort } from "@/lib/wallet/schema";
import { cn } from "@/lib/utils";

type SortKey = HoldingSort["by"];

export const HOLDING_SORT_LABELS: Record<SortKey, string> = {
  value: "Value",
  name: "Name",
  amount: "Amount",
  change24h: "24h change",
  price: "Price",
  pnl: "Profit/loss",
};

const HEADER_LABELS: Record<SortKey, string> = { ...HOLDING_SORT_LABELS, name: "Coin", change24h: "24h %", pnl: "P/L" };

/** Clicking the current column flips it; a new column starts on its natural order. */
export function nextSort(current: HoldingSort, by: SortKey): HoldingSort {
  if (current.by === by) return { by, dir: current.dir === "asc" ? "desc" : "asc" };
  return { by, dir: by === "name" ? "asc" : "desc" };
}

type Props = {
  rows: HoldingRow[];
  currency: Currency;
  sort: HoldingSort;
  /** Prices still on their first load: value cells show a skeleton, not "—". */
  pricesLoading: boolean;
  onSort: (sort: HoldingSort) => void;
  onEdit: (coinId: string) => void;
  onRemove: (coinId: string) => void;
};

function Skeleton({ className }: { className?: string }) {
  return <span className={cn("inline-block h-3.5 animate-pulse rounded bg-gray-200", className)} aria-label="Loading" />;
}

function CoinIcon({ row }: { row: HoldingRow }) {
  return row.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.image} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 shrink-0 rounded-full" />
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600" aria-hidden="true">
      {row.symbol.charAt(0)}
    </span>
  );
}

function Amount({ row }: { row: HoldingRow }) {
  return (
    <span title={amountIsShortened(row.amount) ? row.amount : undefined} className="tabular-nums">
      {formatAmount(row.amount)}
    </span>
  );
}

function Money({ value, loading, currency, price = false }: { value: HoldingRow["value"]; loading: boolean; currency: Currency; price?: boolean }) {
  if (value === null) return loading ? <Skeleton className="w-16" /> : <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{price ? formatPrice(value, currency) : formatMoney(value, currency)}</span>;
}

/** Profit/loss since bought: % on top, the amount below. "—" without a buy price. */
function Pnl({ row, loading, currency }: { row: HoldingRow; loading: boolean; currency: Currency }) {
  if (row.pnl === null) {
    if (row.cost !== null && loading) return <Skeleton className="w-14" />;
    return (
      <span className="text-muted-foreground" title={row.cost === null ? "No buy price set" : undefined}>
        —
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <ChangeText pct={row.pnlPct} />
      <span className="text-xs tabular-nums text-gray-500">{formatSignedMoney(row.pnl, currency)}</span>
    </span>
  );
}

/**
 * A wallet's coins: a sortable table from `sm` up, stacked rows on phones.
 * Only the layout that fits is rendered; with many wallets, rendering both
 * and hiding one with CSS doubled the work.
 */
export default function HoldingsTable(props: Props) {
  const wide = useMediaQuery("(min-width: 640px)", true);
  return wide ? <DesktopTable {...props} /> : <MobileList {...props} />;
}

function SortHeader({ by, sort, onSort, align = "right" }: { by: SortKey; sort: HoldingSort; onSort: Props["onSort"]; align?: "left" | "right" }) {
  const active = sort.by === by;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 font-medium", align === "right" ? "text-right" : "text-left")}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, by))}
        className={cn(
          "inline-flex items-center gap-1 rounded hover:text-gray-900",
          align === "right" && "flex-row-reverse",
          active ? "text-gray-900" : "text-gray-500"
        )}
      >
        {HEADER_LABELS[by]}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} aria-hidden="true" />
      </button>
    </th>
  );
}

function DesktopTable({ rows, currency, sort, pricesLoading, onSort, onEdit, onRemove }: Props) {
  return (
    <div className="overflow-x-auto">
      {/* Fixed widths so columns line up from one wallet card to the next */}
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[14%]" />
          <col className="w-[15%]" />
          <col className="w-[16%]" />
          <col className="w-[11%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead className="border-b text-xs">
          <tr>
            <SortHeader by="name" sort={sort} onSort={onSort} align="left" />
            <SortHeader by="amount" sort={sort} onSort={onSort} />
            <SortHeader by="price" sort={sort} onSort={onSort} />
            <SortHeader by="value" sort={sort} onSort={onSort} />
            <SortHeader by="change24h" sort={sort} onSort={onSort} />
            <SortHeader by="pnl" sort={sort} onSort={onSort} />
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.coinId} className="group hover:bg-gray-50">
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2.5">
                  <CoinIcon row={row} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-900">{row.symbol}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.name}</span>
                  </span>
                </span>
              </td>
              <td className="truncate px-3 py-2.5 text-right text-gray-700">
                <Amount row={row} />
              </td>
              <td className="px-3 py-2.5 text-right text-gray-700">
                <Money value={row.price} loading={pricesLoading} currency={currency} price />
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                <Money value={row.value} loading={pricesLoading} currency={currency} />
              </td>
              <td className="px-3 py-2.5 text-right">
                {row.change24hPct === null && pricesLoading ? <Skeleton className="w-12" /> : <ChangeText pct={row.change24hPct} />}
              </td>
              <td className="px-3 py-2.5 text-right">
                <Pnl row={row} loading={pricesLoading} currency={currency} />
              </td>
              <td className="px-3 py-2.5">
                <span className="flex justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => onEdit(row.coinId)}
                    aria-label={`Edit ${row.symbol}`}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(row.coinId)}
                    aria-label={`Remove ${row.symbol}`}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileList({ rows, currency, pricesLoading, onEdit, onRemove }: Props) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.coinId} className="flex items-start gap-2.5 py-2.5">
          <CoinIcon row={row} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold text-gray-900">
                {row.symbol} <span className="text-xs font-normal text-muted-foreground">{row.name}</span>
              </span>
              <span className="shrink-0 font-semibold text-gray-900">
                <Money value={row.value} loading={pricesLoading} currency={currency} />
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-gray-600">
              <span className="truncate">
                <Amount row={row} /> × <Money value={row.price} loading={pricesLoading} currency={currency} price />
              </span>
              {row.change24hPct === null && pricesLoading ? <Skeleton className="w-10" /> : <ChangeText pct={row.change24hPct} className="shrink-0" />}
            </div>
            {row.pnl !== null && (
              <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-gray-600">
                <span>Profit/loss</span>
                <ChangeText value={row.pnl} pct={row.pnlPct} currency={currency} className="shrink-0" />
              </div>
            )}
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label={`${row.symbol} options`}
              className="-mr-1 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 data-[state=open]:bg-gray-100"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-36 rounded-lg border bg-white p-1 shadow-lg">
                <DropdownMenu.Item
                  onSelect={() => onEdit(row.coinId)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-highlighted:bg-gray-100"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit amount or price
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => onRemove(row.coinId)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-red-700 outline-none data-highlighted:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </li>
      ))}
    </ul>
  );
}
