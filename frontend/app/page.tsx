"use client";

import { Suspense } from "react";
import CryptoTable from "@/components/coin/CryptoTable";
import CoinStats from "@/components/coin/CoinStats";


export default function Home() {
  return (
    <div className="flex flex-col py-4 mx-auto">
      <CoinStats />
      {/* CryptoTable reads ?page= from the URL, which needs a Suspense
          boundary so the rest of the page can still be prerendered. */}
      <Suspense
        fallback={
          <div className="mt-2 h-96 w-full animate-pulse rounded-xl bg-white shadow-sm" />
        }
      >
        <CryptoTable />
      </Suspense>
    </div>
  )
}
