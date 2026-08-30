"use client";

import { useTrendingCoins } from "@/hooks/useTrending";
import PriceChange from "@/components/PriceChange";
import Image from "next/image";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ArrowUp, ArrowDown } from "lucide-react";

export default function Trending() {
  const { coins } = useTrendingCoins();

  return (
    <Card className="mx-auto h-47 w-full mb-4">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">
          Trending
        </CardTitle>

        <CardDescription className="space-y-3">
          {coins?.map((coin) => {
            const isPositive = coin.price_change_percentage_24h >= 0;

            return (
              <div
                key={coin.id}
                className="flex items-center justify-between"
              >
                {/* Left side */}
                <div className="flex items-center gap-3">
                  <Image
                    src={coin.image}
                    alt={coin.name}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />

                  <div>
                    <p className="font-medium text-foreground">
                      {coin.name}
                    </p>
                      <p className="text-xs mr-1 text-muted-foreground">${coin.price.toLocaleString(undefined, {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}
                      </p>
                  </div>
                </div>

                {/* Right side */}
                <div className={`flex items-center text-sm font-semibold`} >
                  <PriceChange value={coin.price_change_percentage_24h} />
                </div>
              </div>
            );
          })}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}