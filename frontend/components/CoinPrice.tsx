"use client";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ArrowUp, ArrowDown } from "lucide-react";

export default function CoinPrice() {
  const {
    prices,
    changePercentage,
    isLoading,
  } = useCryptoPrices();

  const isPositive = changePercentage >= 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-gray-700 font-semibold">{prices.length > 0 ? prices[0].name : "Loading..."}</CardTitle>

          {!isLoading && (
            <div
              className={`flex lg:items-center text-sm font-semibold ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositive ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}

              {Math.abs(changePercentage).toFixed(2)}%
            </div>
          )}
        </div>

        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
          {prices.length > 0 ? `$${prices[0].current_price.toLocaleString()}` : "Loading..."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}