"use client"

import MarketCap from "@/components/coin/MarketCap"
import TradingVolume from "@/components/coin/TradingVolume"
import Trending from "@/components/coin/Trending"
import TopGainers from "@/components/coin/TopGainers"


export default function CoinStats() {
    return (
            <div className="flex flex-col">
                <div className="sm:mx-2 md:mx-4 lg:mx-0">
                    <div className="mx-auto max-w-5xl p-2">
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
                    </div>
                </div>
            </div>
    )
}