"use client";

import CryptoTable from "@/components/coin/CryptoTable";
import CoinStats from "@/components/coin/CoinStats";


export default function Home() {
  return (
    <div className="flex flex-col py-4 mx-auto">
      <CoinStats />
      <p className="text-gray-600 mx-2 md:mx-5 lg:mx-2">
        Welcome to the Crypto Tracker! Stay updated with the latest cryptocurrency prices and market data. Click on any coin to view detailed statistics.
      </p>
      <CryptoTable />
    </div>
  )
}