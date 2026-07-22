import { useTrendingCoins } from "@/hooks/useTrending";
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
            const isPositive = coin.changePercentage >= 0;

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
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                  </div>
                </div>

                {/* Right side */}
                <div
                  className={`flex items-center text-sm font-semibold ${
                    isPositive
                    ? "text-green-500"
                    : "text-red-500"
                  }`}
                  >
                  {isPositive ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}

                  {Math.abs(coin.changePercentage).toFixed(2)}%
                </div>
              </div>
            );
          })}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}