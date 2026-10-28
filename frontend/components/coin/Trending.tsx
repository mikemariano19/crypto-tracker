"use client";

import { Flame } from "lucide-react";

import CoinListCard from "@/components/coin/CoinListCard";
import { METRIC_INFO } from "@/lib/metricInfo";
import { useTrendingCoins } from "@/hooks/useTrending";

export default function Trending() {
  const { coins, isValidating } = useTrendingCoins();

  return (
    <CoinListCard
      info={METRIC_INFO.trending}
      subtitle="Most searched coins"
      icon={<Flame className="h-4 w-4 text-orange-500" />}
      iconClassName="bg-orange-50"
      href="/trending"
      moreLabel="View all trending"
      coins={coins}
      isValidating={isValidating}
      variant="price"
    />
  );
}
