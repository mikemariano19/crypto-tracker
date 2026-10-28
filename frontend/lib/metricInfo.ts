export type MetricInfo = {
  title: string;
  description: string;
};

// Plain-language explanations shown in InfoTip popovers.
export const METRIC_INFO = {
  marketCap: {
    title: "Market Cap",
    description:
      "Current price × circulating supply. The total value of all coins in circulation right now, and how coins are ranked by size.",
  },
  fdv: {
    title: "Fully Diluted Valuation",
    description:
      "Price × max supply (or total supply if there is no max). What the market cap would be if every coin that will ever exist were circulating. A big gap above market cap means future dilution from unlocks or emissions.",
  },
  volume: {
    title: "24h Volume",
    description:
      "The total value of this coin traded across exchanges in the last 24 hours. Higher volume means more liquidity, so it is easier to buy or sell without moving the price.",
  },
  volumeToMarketCap: {
    title: "Volume / Market Cap",
    description:
      "24h volume divided by market cap: how actively the coin trades relative to its size. Higher means more liquid. An unusually high ratio can signal hype or a big news move.",
  },
  circulatingSupply: {
    title: "Circulating Supply",
    description:
      "Coins publicly available and trading right now. Excludes coins that are locked, reserved by the team, or not yet mined. The percentage shows how much of the max supply is already out.",
  },
  totalSupply: {
    title: "Total Supply",
    description:
      "All coins created so far minus any burned, including locked or reserved coins that are not circulating yet.",
  },
  maxSupply: {
    title: "Max Supply",
    description:
      "The hard cap on coins that can ever exist. ∞ means there is no cap, so new coins can keep being created (inflationary).",
  },
  ath: {
    title: "All-Time High",
    description:
      "The highest price ever recorded. The percentage shows how far the current price is below it.",
  },
  atl: {
    title: "All-Time Low",
    description:
      "The lowest price ever recorded. The percentage shows how far the current price has risen above it.",
  },
  globalMarketCap: {
    title: "Market Cap",
    description:
      "The combined value of every cryptocurrency (price × circulating supply, summed). The percentage is its change over the last 24 hours: a quick read on whether money is entering or leaving crypto.",
  },
  globalVolume: {
    title: "24h Trading Volume",
    description:
      "The total value of all crypto traded across exchanges in the last 24 hours. Rising volume confirms a price move; a move on low volume is easier to reverse.",
  },
  trending: {
    title: "Trending",
    description:
      "The coins people searched for most on CoinGecko in the last 24 hours. Rising attention often comes before big price moves, but trending doesn't mean the price is going up.",
  },
  topGainers: {
    title: "Top Gainers",
    description:
      "The biggest 24h price increases among the top 250 coins by market cap. Fast movers can reverse just as fast, so check volume before chasing a pump.",
  },
  btcDominance: {
    title: "BTC Dominance",
    description:
      "Bitcoin's share of the total crypto market cap. Rising dominance means money is flowing into BTC; falling dominance often signals an 'altcoin season'.",
  },
  fearGreed: {
    title: "Fear & Greed Index",
    description:
      "A 0–100 sentiment score (by alternative.me, updated daily) built from volatility, momentum, social media, dominance and search trends. Extreme fear can mean a buying opportunity; extreme greed can mean a correction is due.",
  },
} satisfies Record<string, MetricInfo>;
