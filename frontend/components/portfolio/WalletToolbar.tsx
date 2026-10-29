"use client";

import { Download, Plus, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WalletSort } from "@/lib/wallet/schema";

const SORT_OPTIONS: { value: `${WalletSort["by"]}:${WalletSort["dir"]}`; label: string }[] = [
  { value: "value:desc", label: "Total value (high → low)" },
  { value: "value:asc", label: "Total value (low → high)" },
  { value: "name:asc", label: "Name (A–Z)" },
  { value: "name:desc", label: "Name (Z–A)" },
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
];

/**
 * Search wallets by name, choose wallet order, create a wallet, and back up.
 */
export default function WalletToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  onNewWallet,
  onExport,
  onImport,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: WalletSort;
  onSortChange: (sort: WalletSort) => void;
  onNewWallet: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search wallets by name…"
          aria-label="Search wallets by name"
          className="h-9 w-full rounded-lg border bg-white pl-9 pr-8 text-sm outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <span className="hidden sm:inline">Sort</span>
        <span className="sr-only sm:hidden">Sort wallets</span>
        <select
          value={`${sort.by}:${sort.dir}`}
          onChange={(event) => {
            const [by, dir] = event.target.value.split(":") as [WalletSort["by"], WalletSort["dir"]];
            onSortChange({ by, dir });
          }}
          className="h-9 rounded-lg border bg-white px-2 text-sm text-gray-800"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <Button size="lg" onClick={onNewWallet}>
        <Plus aria-hidden="true" /> New wallet
      </Button>

      <div className="flex gap-1">
        <Button variant="outline" size="lg" onClick={onExport} title="Download a backup file">
          <Download aria-hidden="true" /> Export
        </Button>
        <Button variant="outline" size="lg" onClick={onImport} title="Restore from a backup file">
          <Upload aria-hidden="true" /> Import
        </Button>
      </div>
    </div>
  );
}
