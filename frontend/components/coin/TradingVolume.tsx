"use client";

import { useTradingVolume } from "@/hooks/useTradingVolume";
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { formatCompactUsd, formatFullUsd } from "@/lib/formatCompactUsd";
import { METRIC_INFO } from "@/lib/metricInfo";
import InfoTip from "@/components/InfoTip";

export default function TradingVolume() {
  const { volume_24h } = useTradingVolume();

  return (
    <Card className="h-full justify-center border-0 shadow-sm">
      <CardContent>

        <InfoTip
          {...METRIC_INFO.globalVolume}
          exactValue={formatFullUsd(volume_24h)}
          className="mb-2 gap-2"
        >

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>

          <span className="text-sm font-medium text-muted-foreground">
            24h Trading Volume
          </span>

        </InfoTip>

        {volume_24h ? (
          <p className="truncate text-2xl font-bold tracking-tight">
            {formatCompactUsd(volume_24h)}
          </p>
        ) : (
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Total trading activity across the market
        </p>

      </CardContent>
    </Card>
  );
}