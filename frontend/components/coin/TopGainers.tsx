"use client";

import { useTopGainers } from "@/hooks/useTopGainers";
import { formatPercentage } from "@/lib/formatCryptoStats";
import Image from "next/image";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ArrowUp, TrendingUp } from "lucide-react";

export default function TopGainers() {
  const { coins } = useTopGainers();

  return (
    <Card className="w-full border-0 shadow-sm">

      <CardHeader className="px-4 pb-2 pt-4">

        <div className="flex items-center gap-2">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>

          <div>
            <CardTitle className="text-base font-bold">
              Top Gainers
            </CardTitle>

            <p className="text-xs text-muted-foreground">
              Biggest 24h movers
            </p>
          </div>

        </div>

      </CardHeader>


      <CardContent className="px-4 pb-4">

        <div className="divide-y">

          {coins?.slice(0, 5).map((coin) => {

            const isPositive =
              coin.price_change_percentage_24h >= 0;

            return (
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

                    <p className="text-[11px] uppercase text-muted-foreground">
                      {coin.symbol}
                    </p>

                  </div>

                </div>


                {/* Gain */}
                <div
                  className={`flex items-center gap-0.5 shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                    isPositive
                      ? "bg-green-50 text-green-600"
                      : "bg-red-50 text-red-500"
                  }`}
                >

                  {isPositive && (
                    <ArrowUp className="h-3 w-3" />
                  )}

                  {formatPercentage(
                    coin.price_change_percentage_24h
                  )}

                </div>

              </div>
            );
          })}

        </div>

      </CardContent>

    </Card>
  );
}