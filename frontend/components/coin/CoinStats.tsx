"use client"

import MarketCap from "@/components/coin/MarketCap"
import TradingVolume from "@/components/coin/TradingVolume"
import Trending from "@/components/coin/Trending"
import TopGainers from "@/components/coin/TopGainers"


export default function CoinStats() {
    return (
        // Grid items stretch, so every card in a row shares one height
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="hidden gap-4 md:col-span-2 md:grid md:grid-cols-2 lg:col-span-1 lg:grid-cols-1 lg:grid-rows-2">
                <MarketCap />
                <TradingVolume />
            </div>
            <Trending />
            <TopGainers />
        </div>
    )
}
