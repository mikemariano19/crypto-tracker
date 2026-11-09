import { Suspense } from "react";
import CryptoTable, { MarketTable } from "@/components/coin/CryptoTable";
import CoinStats from "@/components/coin/CoinStats";
import { CryptoTableFallback, MarketHeading } from "@/components/coin/MarketSection";
import { getTopCoins } from "@/lib/serverMarket";

// Rebuilt in the background at most once a minute (ISR), so visitors always
// get static HTML and never wait on the backend.
export const revalidate = 60;

// A server component: only CoinStats and CryptoTable are client code, so the
// rest of the page is plain HTML with nothing to hydrate.
export default async function Home() {
  const coins = await getTopCoins();

  return (
    <div className="flex flex-col py-4 mx-auto">
      <CoinStats />

      <section className="w-full pt-2">
        {/* Outside the boundary on purpose: see MarketHeading. */}
        <MarketHeading />

        {/* CryptoTable reads ?page= from the URL, which needs a Suspense
            boundary so the rest of the page can still be prerendered. The
            fallback is page 1 with real rows, so the static HTML paints the
            table without waiting for JS or the API. */}
        <Suspense
          fallback={coins
            ? <MarketTable page={1} isFavoritesView={false} initialCoins={coins} />
            : <CryptoTableFallback />}
        >
          <CryptoTable initialCoins={coins ?? undefined} />
        </Suspense>
      </section>
    </div>
  )
}
