import type { Metadata } from "next";
import { TopGainersRanking } from "@/components/coin/CoinRanking";

export const metadata: Metadata = {
  title: "Top 50 Gainers | Crypto Tracker",
  description: "The cryptocurrencies with the biggest 24h price gains.",
};

export default function TopGainersPage() {
  return <TopGainersRanking />;
}
