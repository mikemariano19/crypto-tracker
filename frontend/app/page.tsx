"use client";
import NavBar from "@/components/NavBar";
import CryptoTable from "@/components/CryptoTable";
import MarketCap from "@/components/MarketCap";
import TradingVolume from "@/components/TradingVolume";
import Trending from "@/components/Trending";
import TopGainers from "@/components/TopGainers";
import GlobalStats from "@/components/GlobalStats";

export default function Home() {
  return (
    <>
      <div className="container flex justify-center max-w-4xl mx-auto font-light text-sm">
        <GlobalStats />
      </div>
      <div className="border-y border-gray-100 mb-2 flex justify-center">
        <div className="container">
          <NavBar />
        </div>
      </div>
      <div className="container mx-auto max-w-4xl p-2">
        <div className="grid grid-cols-1 md:grid-cols-3 md:gap-x-4">
            <span className="md:col-span-1">
              <MarketCap />
              <TradingVolume />
            </span>
            <span className="md:col-span-1">
              <Trending />
            </span>
             <span className="md:col-span-1">
              <TopGainers />
            </span>
        </div>
        <CryptoTable />
      </div>
    </>
  );
}
