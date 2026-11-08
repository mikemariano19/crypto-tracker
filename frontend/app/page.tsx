import { Suspense } from "react";
import CryptoTable from "@/components/coin/CryptoTable";
import CoinStats from "@/components/coin/CoinStats";
import { CryptoTableFallback, MarketHeading } from "@/components/coin/MarketSection";

// A server component: only CoinStats and CryptoTable are client code, so the
// rest of the page is plain HTML with nothing to hydrate.
export default function Home() {
  return (
    <div className="flex flex-col py-4 mx-auto">
      <CoinStats />

      <section className="w-full pt-2">
        {/* Outside the boundary on purpose: see MarketHeading. */}
        <MarketHeading />

        {/* CryptoTable reads ?page= from the URL, which needs a Suspense
            boundary so the rest of the page can still be prerendered. */}
        <Suspense fallback={<CryptoTableFallback />}>
          <CryptoTable />
        </Suspense>
      </section>
    </div>
  )
}
