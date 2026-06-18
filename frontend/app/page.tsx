"use client";
import NavBar from "@/components/NavBar";
import CryptoTable from "@/components/CryptoTable";
import MarketCap from "@/components/MarketCap";
import TradingVolume from "@/components/TradingVolume";
import Trending from "@/components/Trending";

export default function Home() {
  return (
    <>
      <div className="container flex justify-center max-w-4xl mx-auto font-light text-sm">
        Coins: 17,435
            Exchanges: 1,491
            Market Cap: $2.283T 1.3%
            24h Vol: $87.228B
            Dominance: 
            BTC 56.1%
            ETH 9.18%
      </div>
      <div className="border-y border-gray-300 mb-4 flex justify-center">
        <div className="container">
          <NavBar />
        </div>
      </div>
      <div className="container mx-auto max-w-4xl p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-4">
            <span className="md:col-span-1">
              <MarketCap />
              <TradingVolume />
            </span>
            <span className="md:col-span-1">
              <Trending />
            </span>
        </div>
        <CryptoTable />
      </div>
    </>
  );
}
