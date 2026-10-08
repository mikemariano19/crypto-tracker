"use client";

import { useTrendingCoins } from "@/hooks/useTrending";
import PriceChange from "@/components/PriceChange";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";

export default function Trending() {
  const { coins } = useTrendingCoins();

  return (
    <Card className="w-full border-0 shadow-sm mb-4 sm:mb-0">

      <CardHeader className="px-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>

            <div>
              <CardTitle className="text-base font-bold">
                Trending
              </CardTitle>

              <p className="text-xs text-muted-foreground">
                Most searched coins
              </p>
            </div>

          </div>

        </div>

      </CardHeader>


      <CardContent className="px-4 pb-4">

        <div className="divide-y">

          {coins?.slice(0, 5).map((coin) => (

            <div
              key={coin.id}
              className="
                flex
                items-center
                justify-between
                gap-3
                py-2.5
              "
            >

              {/* Coin */}
              <div className="flex items-center gap-3 min-w-0">

                <Image
                  src={coin.image}
                  alt={coin.name}
                  width={30}
                  height={30}
                  className="h-7 w-7 rounded-full shrink-0"
                />

                <div className="min-w-0">

                  <p className="text-sm font-semibold truncate">
                    {coin.name}
                  </p>

                  <p className="text-[11px] text-muted-foreground uppercase">
                    {coin.symbol}
                  </p>

                </div>

              </div>


              {/* Price + Change */}
              <div className="text-right shrink-0">

                <p className="text-xs font-medium">
                  ${coin.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </p>

                <div className="text-xs">
                  <PriceChange
                    value={coin.price_change_percentage_24h}
                  />
                </div>

              </div>

            </div>

          ))}

        </div>

      </CardContent>

    </Card>
  );
}