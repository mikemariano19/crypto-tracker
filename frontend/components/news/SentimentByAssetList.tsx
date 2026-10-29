import { Coins } from "lucide-react";

import SidebarCard from "@/components/news/SidebarCard";
import SentimentSplitBar, { SentimentLegend } from "@/components/news/SentimentSplitBar";
import { SentimentIcon } from "@/components/news/SentimentBadge";
import { LABEL_TEXT, SENTIMENT_STYLES } from "@/lib/formatNews";
import type { AssetSentiment, SentimentLabel, SentimentSplit } from "@/types/news";

function dominant(split: SentimentSplit): SentimentLabel {
  const max = Math.max(split.bullish, split.bearish, split.neutral);
  const leaders = (["bullish", "bearish", "neutral"] as const).filter((label) => split[label] === max);
  return leaders.length === 1 ? leaders[0] : "neutral";
}

/**
 * Per-coin mini split bars. Clicking a coin filters the feed to it.
 */
export default function SentimentByAssetList({
  assets,
  activeAsset,
  onSelect,
}: {
  assets: AssetSentiment[];
  activeAsset: string | null;
  onSelect: (asset: string | null) => void;
}) {
  return (
    <SidebarCard
      title="Sentiment by coin"
      subtitle="Most-covered coins, last 24h"
      icon={<Coins className="h-4 w-4 text-orange-500" />}
      iconClassName="bg-orange-50"
    >
      {assets.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Appears once stories are AI-analyzed.
        </p>
      ) : (
        <>
        <SentimentLegend className="mb-2" />
        <ul className="-mx-2 space-y-0.5">
          {assets.map(({ asset, sentiment, storyCount }) => {
            const label = dominant(sentiment);
            const isActive = activeAsset === asset;

            return (
              <li key={asset}>
                <button
                  type="button"
                  onClick={() => onSelect(isActive ? null : asset)}
                  aria-pressed={isActive}
                  className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                    isActive ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="mb-1.5 flex items-center gap-2 text-xs">
                    <span className="font-bold text-gray-900">{asset}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {storyCount} {storyCount === 1 ? "story" : "stories"}
                    </span>
                    <span className={`ml-auto inline-flex items-center gap-1 text-[11px] font-semibold ${SENTIMENT_STYLES[label].text}`}>
                      <SentimentIcon label={label} className="h-2 w-2" />
                      {LABEL_TEXT[label]} {sentiment[label]}%
                    </span>
                  </span>
                  <SentimentSplitBar split={sentiment} size="md" showLegend={false} />
                </button>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </SidebarCard>
  );
}
