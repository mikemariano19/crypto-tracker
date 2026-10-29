"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ConfirmDialog from "@/components/portfolio/ConfirmDialog";
import { NoMatches, NoWallets, PortfolioSkeleton } from "@/components/portfolio/EmptyState";
import HoldingForm, { type HoldingFormTarget } from "@/components/portfolio/HoldingForm";
import ImportDialog from "@/components/portfolio/ImportDialog";
import { PrivacyNotice, StalePricesBanner, StorageNotice } from "@/components/portfolio/Notices";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import WalletCard from "@/components/portfolio/WalletCard";
import WalletForm, { type WalletFormTarget } from "@/components/portfolio/WalletForm";
import WalletToolbar from "@/components/portfolio/WalletToolbar";
import { useCoinPrices } from "@/hooks/useCoinPrices";
import { useWalletProviders } from "@/hooks/useWalletProviders";
import { useWalletStore } from "@/hooks/useWalletStore";
import {
  allocation,
  filterWallets,
  portfolioTotals,
  sortWallets,
  summarizeWallet,
  type WalletSummary,
} from "@/lib/portfolio";
import { backupFileName, downloadText, serializeBackup } from "@/lib/wallet/backup";
import type { PriceMap } from "@/lib/wallet/prices";
import type { Currency, Wallet } from "@/lib/wallet/schema";

const SEARCH_DEBOUNCE_MS = 150;

// Per-wallet results, reused while the wallet and its coins' prices are
// unchanged, so a price refresh only recomputes (and redraws) wallets whose
// numbers actually moved. Wallet objects are replaced on every edit, so a
// WeakMap keyed by them never serves an outdated wallet.
const summaryCache = new WeakMap<Wallet, Partial<Record<Currency, { signature: string; summary: WalletSummary }>>>();

function walletSummary(wallet: Wallet, prices: PriceMap, currency: Currency): WalletSummary {
  const signature = wallet.holdings
    .map((holding) => {
      const quote = prices[holding.coinId];
      return quote ? `${quote[currency]}:${quote[`${currency}_24h_change`]}` : "-";
    })
    .join("|");

  const cached = summaryCache.get(wallet)?.[currency];
  if (cached?.signature === signature) return cached.summary;

  const summary = summarizeWallet(wallet, prices, currency);
  summaryCache.set(wallet, { ...summaryCache.get(wallet), [currency]: { signature, summary } });
  return summary;
}

type Confirm =
  | { kind: "wallet"; walletId: string }
  | { kind: "coin"; walletId: string; coinId: string };

type HoldingDialog = { kind: "add"; walletId: string } | { kind: "edit"; walletId: string; coinId: string };

type WalletDialog = { kind: "create" } | { kind: "rename"; walletId: string };

/**
 * The wallet tracker: everything lives in this browser (useWalletStore);
 * only the list of coin ids goes to the server, to fetch prices.
 */
export default function PortfolioPage() {
  const store = useWalletStore();
  const { state, setCollapsed, setHoldingSort, removeHolding, deleteWallet, createWallet, renameWallet } = store;

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery.trim());

  // Debounce typing, then mirror the search into ?q= so it survives refresh.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      setQuery(next);
      if (next !== urlQuery.trim()) {
        router.replace(next ? `/portfolio?q=${encodeURIComponent(next)}` : "/portfolio", { scroll: false });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, urlQuery, router]);

  const coinIds = useMemo(
    () => state?.wallets.flatMap((wallet) => wallet.holdings.map((holding) => holding.coinId)) ?? [],
    [state]
  );
  const prices = useCoinPrices(coinIds);
  const { byId: providers } = useWalletProviders();

  const [announce, setAnnounce] = useState(false);
  const refresh = () => {
    setAnnounce(true);
    prices.refresh();
    setTimeout(() => setAnnounce(false), 5_000);
  };

  const selectedCurrency = state?.currency ?? "usd";
  // A big portfolio takes a moment to redraw in the other currency: the
  // toggle flips at once, and the numbers follow without blocking input.
  const currency = useDeferredValue(selectedCurrency);
  const updatingCurrency = currency !== selectedCurrency;
  const otherCurrency: Currency = currency === "usd" ? "php" : "usd";

  const derived = useMemo(() => {
    if (!state) return null;

    const summaries = state.wallets.map((wallet) => walletSummary(wallet, prices.prices, currency));
    const visible = filterWallets(sortWallets(summaries, state.walletSort), query);
    const otherTotal = portfolioTotals(state.wallets.map((wallet) => walletSummary(wallet, prices.prices, otherCurrency))).total;

    return {
      visible,
      totals: portfolioTotals(summaries),
      shown: query ? portfolioTotals(visible) : null,
      otherTotal,
      slices: allocation(summaries),
    };
  }, [state, prices.prices, currency, otherCurrency, query]);

  // Dialogs hold ids; the objects are looked up fresh on every render.
  const [walletDialog, setWalletDialog] = useState<WalletDialog | null>(null);
  const [holdingDialog, setHoldingDialog] = useState<HoldingDialog | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6_000);
    return () => clearTimeout(timer);
  }, [message]);

  const exportBackup = () => {
    downloadText(serializeBackup(store.exportState()), backupFileName());
    setMessage("Backup downloaded. Keep the file somewhere safe.");
  };

  const findWallet = (id: string) => state?.wallets.find((wallet) => wallet.id === id);

  // Stable handlers keep memoized wallet cards from redrawing needlessly.
  const handlers = useMemo(
    () => ({
      onToggle: (walletId: string, collapsed: boolean) => void setCollapsed(walletId, collapsed),
      onSortHoldings: (walletId: string, sort: Wallet["holdingSort"]) => void setHoldingSort(walletId, sort),
      onAddCoin: (walletId: string) => setHoldingDialog({ kind: "add", walletId }),
      onEditCoin: (walletId: string, coinId: string) => setHoldingDialog({ kind: "edit", walletId, coinId }),
      onRemoveCoin: (walletId: string, coinId: string) => setConfirm({ kind: "coin", walletId, coinId }),
      onRename: (walletId: string) => setWalletDialog({ kind: "rename", walletId }),
      onDelete: (walletId: string) => setConfirm({ kind: "wallet", walletId }),
    }),
    [setCollapsed, setHoldingSort]
  );

  if (!state || !derived) return <PortfolioSkeleton />;

  const walletTarget: WalletFormTarget | null = (() => {
    if (!walletDialog) return null;
    if (walletDialog.kind === "create") return walletDialog;
    const wallet = findWallet(walletDialog.walletId);
    return wallet ? { kind: "rename", wallet } : null;
  })();

  const holdingTarget: HoldingFormTarget | null = (() => {
    if (!holdingDialog) return null;
    const wallet = findWallet(holdingDialog.walletId);
    if (!wallet) return null;
    if (holdingDialog.kind === "add") return { kind: "add", wallet };
    const holding = wallet.holdings.find((h) => h.coinId === holdingDialog.coinId);
    return holding ? { kind: "edit", wallet, holding } : null;
  })();

  const confirmWallet = confirm ? findWallet(confirm.walletId) : undefined;
  const confirmHolding = confirm?.kind === "coin" ? confirmWallet?.holdings.find((h) => h.coinId === confirm.coinId) : undefined;
  const coinCount = confirmWallet?.holdings.length ?? 0;

  const pricesLoading = prices.isLoading;

  return (
    // Visible keyboard focus on every plain button and select on the page.
    <div className="flex flex-col gap-4 py-4 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-gray-500 [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-gray-500">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your wallets and holdings, valued with live prices.</p>
      </div>

      {message && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      )}

      <StorageNotice
        persistence={store.persistence}
        recoveredFrom={store.recoveredFrom}
        onDismissRecovery={store.dismissRecovery}
      />

      {state.wallets.length === 0 ? (
        <NoWallets onCreate={() => setWalletDialog({ kind: "create" })} onImport={() => setImportOpen(true)} />
      ) : (
        <>
          {prices.isStale && <StalePricesBanner updatedAt={prices.updatedAt} />}

          <PortfolioSummary
            totals={derived.totals}
            shown={derived.shown}
            otherCurrencyTotal={derived.otherTotal}
            currency={currency}
            selectedCurrency={selectedCurrency}
            onCurrencyChange={store.setCurrency}
            slices={derived.slices}
            pricesLoading={pricesLoading && coinIds.length > 0}
            updatedAt={prices.updatedAt}
            isRefreshing={prices.isRefreshing}
            onRefresh={refresh}
            announce={announce}
          />

          <WalletToolbar
            search={search}
            onSearchChange={setSearch}
            sort={state.walletSort}
            onSortChange={store.setWalletSort}
            onNewWallet={() => setWalletDialog({ kind: "create" })}
            onExport={exportBackup}
            onImport={() => setImportOpen(true)}
          />

          {derived.visible.length === 0 ? (
            <NoMatches query={query || search.trim()} onClear={() => setSearch("")} />
          ) : (
            <div className={`flex flex-col gap-3 transition-opacity ${updatingCurrency ? "opacity-60" : ""}`} aria-busy={updatingCurrency}>
              {derived.visible.map((summary) => (
                <WalletCard
                  key={summary.wallet.id}
                  summary={summary}
                  currency={currency}
                  query={query}
                  pricesLoading={pricesLoading}
                  provider={(summary.wallet.provider && providers.get(summary.wallet.provider)) || null}
                  {...handlers}
                />
              ))}
            </div>
          )}
        </>
      )}

      <PrivacyNotice />

      <WalletForm
        target={walletTarget}
        wallets={state.wallets}
        onClose={() => setWalletDialog(null)}
        onSubmit={(target, input) =>
          target.kind === "create" ? createWallet(input) : renameWallet(target.wallet.id, input)
        }
      />

      <HoldingForm
        target={holdingTarget}
        currency={selectedCurrency}
        onClose={() => setHoldingDialog(null)}
        addHolding={store.addHolding}
        updateHolding={store.updateHolding}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        currentWallets={state.wallets.length}
        importState={store.importState}
        onImported={setMessage}
      />

      <ConfirmDialog
        open={confirm !== null && confirmWallet !== undefined}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.kind === "coin" ? `Remove ${confirmHolding?.symbol ?? "coin"}?` : `Delete “${confirmWallet?.name ?? ""}”?`}
        description={
          confirm?.kind === "coin"
            ? `This removes ${confirmHolding?.name ?? "the coin"} from ${confirmWallet?.name ?? "this wallet"}.`
            : coinCount > 0
              ? `This also removes its ${coinCount} ${coinCount === 1 ? "coin" : "coins"}. It can't be undone.`
              : "It can't be undone."
        }
        confirmLabel={confirm?.kind === "coin" ? "Remove" : "Delete wallet"}
        onConfirm={() => {
          if (confirm?.kind === "coin") removeHolding(confirm.walletId, confirm.coinId);
          else if (confirm) deleteWallet(confirm.walletId);
          setConfirm(null);
        }}
      />
    </div>
  );
}
