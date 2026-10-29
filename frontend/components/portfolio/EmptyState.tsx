import { Plus, SearchX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** First visit: nothing saved yet. */
export function NoWallets({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-white px-6 py-12 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Wallet className="h-6 w-6 text-gray-600" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-gray-900">Track your crypto in one place</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Make a wallet for each place you hold coins, add the amounts, and see their value in USD or PHP with live prices.
          No account needed.
        </p>
      </div>
      <Button size="lg" onClick={onCreate}>
        <Plus aria-hidden="true" /> Create your first wallet
      </Button>
      <button type="button" onClick={onImport} className="text-sm font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
        or import a backup
      </button>
    </div>
  );
}

/** Search that matches no wallet name. */
export function NoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-white px-6 py-10 text-center">
      <SearchX className="h-6 w-6 text-gray-400" aria-hidden="true" />
      <p className="text-sm text-gray-700">No wallets named “{query}”.</p>
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

/** Before this browser's saved wallets are read (and on the server). */
export function PortfolioSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading portfolio">
      <div className="h-36 animate-pulse rounded-xl border bg-white" />
      <div className="h-9 animate-pulse rounded-lg bg-gray-200/70" />
      <div className="h-40 animate-pulse rounded-xl border bg-white" />
      <div className="h-16 animate-pulse rounded-xl border bg-white" />
    </div>
  );
}
