import { useMarketCap } from "@/hooks/useMarketCap";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ArrowUp, ArrowDown } from "lucide-react";

export default function MarketCap() {
  const {
    marketCap,
    changePercentage,
    isLoading,
  } = useMarketCap();

  const isPositive = changePercentage >= 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-gray-700 font-semibold">Market Cap</CardTitle>

          {!isLoading && (
            <div
              className={`flex items-center text-sm font-semibold ${
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
          ${marketCap ? marketCap : "Loading..."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}