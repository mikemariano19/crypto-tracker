"use client";

import { TrendingUp } from "lucide-react";

import CoinListCard from "@/components/coin/CoinListCard";
import { METRIC_INFO } from "@/lib/metricInfo";
import { useTopGainers } from "@/hooks/useTopGainers";

export default function TopGainers() {
  const { coins, isValidating } = useTopGainers();

  return (
    <CoinListCard
      info={METRIC_INFO.topGainers}
      subtitle="Biggest 24h movers"
      icon={<TrendingUp className="h-4 w-4 text-green-600" />}
      iconClassName="bg-green-50"
      href="/top-gainers"
      moreLabel="View top 50 gainers"
      coins={coins}
      isValidating={isValidating}
      variant="price"
    />
  );
}
