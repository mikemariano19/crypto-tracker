import type { Metadata } from "next";
import { TrendingRanking } from "@/components/coin/CoinRanking";

export const metadata: Metadata = {
  title: "Trending Coins | Crypto Tracker",
  description: "The most searched cryptocurrencies in the last 24 hours.",
};

export default function TrendingPage() {
  return <TrendingRanking />;
}
