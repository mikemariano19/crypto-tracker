"use client";

import { useTradingVolume } from "@/hooks/useTradingVolume";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

function formatVolume(value: number | undefined) {
  if (!value) return "$0";

  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  return `$${value.toLocaleString()}`;
}

export default function TradingVolume() {
  const { volume_24h } = useTradingVolume();

  return (
    <Card className="w-full border-0 shadow-sm mt-4">
      <CardContent className="px-4">

        <div className="flex items-center gap-2 mb-2">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>

          <span className="text-sm font-medium text-muted-foreground">
            24h Trading Volume
          </span>

        </div>

        <p className="text-2xl font-bold tracking-tight">
          {formatVolume(volume_24h)}
        </p>

        <p className="mt-2 text-xs text-muted-foreground">
          Total trading activity across the market
        </p>

      </CardContent>
    </Card>
  );
}