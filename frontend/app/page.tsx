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
    <div className="sm:mx-2 md:mx-4 lg:mx-auto">
      <div className="container flex justify-center max-w-4xl mx-auto font-light text-sm">
        <GlobalStats />
      </div>
      <div className="mb-2 flex justify-center">
        <div className="container">
          <NavBar />
        </div>
      </div>
      <div className="mx-auto max-w-4xl p-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 md:gap-x-4">
            <span className="col-span-1 hidden lg:block gap-x-8">
              <MarketCap />
              <TradingVolume />
            </span>
            <span className="col-span-1">
              <Trending />
            </span>
             <span className="col-span-1">
              <TopGainers />
            </span>
        </div>
        <CryptoTable />
      </div>
    </div>
  );
}
