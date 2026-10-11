"use client";

import CryptoTable from "@/components/coin/CryptoTable";
import CoinStats from "@/components/coin/CoinStats";


export default function Home() {
  return (
    <div className="flex flex-col py-4 mx-auto">
      <CoinStats />
      <CryptoTable />
    </div>
  )
}