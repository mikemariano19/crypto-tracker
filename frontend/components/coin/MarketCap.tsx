"use client";

import { useMarketCap } from "@/hooks/useMarketCap";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, BarChart3 } from "lucide-react";

export default function MarketCap() {
  const {
    marketCap,
    changePercentage,
    isLoading,
  } = useMarketCap();

  const isPositive = changePercentage >= 0;

  return (
    <Card className="w-full border-0 shadow-sm mb-2">
      <CardContent className="px-4">

        <div className="flex items-start justify-between gap-3">

          {/* Left */}
          <div className="min-w-0">

            <div className="flex items-center gap-2 mb-2">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>

              <span className="text-sm font-medium text-muted-foreground">
                Market Cap
              </span>

            </div>

            <p className="text-2xl font-bold tracking-tight text-foreground">
              {isLoading ? "Loading..." : `$${marketCap || "0"}`}
            </p>

          </div>


          {/* Change */}
          {!isLoading && (
            <div
              className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold ${
                isPositive
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-500"
              }`}
            >
              {isPositive ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}

              {Math.abs(changePercentage).toFixed(2)}%
            </div>
          )}

        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Global cryptocurrency market capitalization
        </p>

      </CardContent>
    </Card>
  );
}