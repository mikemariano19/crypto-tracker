// Server-rendered parts of the home page's market section: static HTML, no
// JavaScript to download or hydrate. Kept out of CryptoTable.tsx, whose
// "use client" would turn them into client components.

/**
 * The table's title and subtitle, rendered by the page outside the table's
 * Suspense boundary. That keeps the same element from the static HTML
 * through hydration: the subtitle is the page's largest text on phones (its
 * LCP), and an element the boundary swapped in later would count as a new,
 * late paint. So nothing in it may depend on ?page= or the view.
 */
export function MarketHeading() {
  return (
    <div id="market" className="scroll-mt-20">
      <h2 className="text-lg font-bold">
        Cryptocurrency Market
      </h2>

      <p className="text-xs text-muted-foreground">Top cryptocurrencies by market capitalization</p>
    </div>
  );
}

/**
 * What the static HTML shows until the table can read ?page= (only possible
 * in the browser): placeholders shaped like the toolbar and rows.
 */
export function CryptoTableFallback() {
  return (
    <div className="w-full" aria-busy="true">
      <div className="mb-3 flex flex-col gap-3">
        {/* Holds the place of the "Showing #1–50" line. */}
        <div className="h-4" />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-44 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-9 w-full animate-pulse rounded-lg bg-gray-100 sm:w-72" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="h-10 border-b bg-gray-50" />
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex h-14 items-center gap-3 border-b px-4 last:border-0">
            <div className="h-6 w-6 animate-pulse rounded-full bg-gray-100" />
            <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
            <div className="ml-auto h-3 w-20 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
