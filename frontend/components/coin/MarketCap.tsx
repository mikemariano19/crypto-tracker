"use client";

import { useMarketCap } from "@/hooks/useMarketCap";
import { formatCompactUsd, formatFullUsd } from "@/lib/formatCompactUsd";
import { METRIC_INFO } from "@/lib/metricInfo";
import InfoTip from "@/components/InfoTip";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, BarChart3 } from "lucide-react";

export default function MarketCap() {
  const {
    marketCap,
    changePercentage,
  } = useMarketCap();

  const isPositive = changePercentage >= 0;

  return (
    <Card className="h-full justify-center border-0 shadow-sm">
      <CardContent>

        <div className="mb-2 flex items-center justify-between gap-3">

          <InfoTip
            {...METRIC_INFO.globalMarketCap}
            exactValue={formatFullUsd(marketCap)}
            className="gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>

            <span className="text-sm font-medium text-muted-foreground">
              Market Cap
            </span>
          </InfoTip>

          {marketCap && (
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

        {marketCap ? (
          <p className="truncate text-2xl font-bold tracking-tight text-foreground">
            {formatCompactUsd(marketCap)}
          </p>
        ) : (
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Global cryptocurrency market capitalization
        </p>

      </CardContent>
    </Card>
  );
}
