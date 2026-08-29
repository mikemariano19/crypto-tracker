"use client"

import CryptoTable from "@/components/CryptoTable"

export default function Default() {
  return (
    <div className="flex py-4 px-2 md:px-6 lg:px-2 max-w-5xl mx-auto">
      <p className="text-gray-600">
        Welcome to the Crypto Tracker! Stay updated with the latest cryptocurrency prices and market data. Click on any coin to view detailed statistics.
        <CryptoTable />
      </p>
    </div>
  )
}