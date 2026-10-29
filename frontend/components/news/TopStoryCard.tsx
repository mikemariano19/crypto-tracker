import NewsStoryCard from "@/components/news/NewsStoryCard";
import type { NewsStory } from "@/types/news";

export default function TopStoryCard({
  story,
  now,
  onAssetClick,
}: {
  story: NewsStory;
  now: number;
  onAssetClick?: (asset: string) => void;
}) {
  return <NewsStoryCard story={story} now={now} featured onAssetClick={onAssetClick} />;
}
