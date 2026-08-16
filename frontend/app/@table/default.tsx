"use client"

import CryptoTable from "@/components/CryptoTable"


export default function Default() {
  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Crypto Tracker</h1>
      <p className="text-gray-600">
        Welcome to the Crypto Tracker! Stay updated with the latest cryptocurrency prices and market data. Click on any coin to view detailed statistics.
      </p>
      <CryptoTable />
    </div>
  )
}