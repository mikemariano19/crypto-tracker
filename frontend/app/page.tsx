"use client";

import MarketCap from "@/components/MarketCap";
import TradingVolume from "@/components/TradingVolume";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl p-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 md:gap-x-4">
        <div className="hidden lg:block">
          <MarketCap />
          <TradingVolume />
        </div>
      </div>
    </div>
  );
}