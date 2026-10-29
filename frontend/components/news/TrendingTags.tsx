import { Hash } from "lucide-react";

import SidebarCard from "@/components/news/SidebarCard";

export default function TrendingTags({ tags }: { tags: Array<{ tag: string; count: number }> }) {
  return (
    <SidebarCard
      title="Trending topics"
      subtitle="Across relevant stories, last 24h"
      icon={<Hash className="h-4 w-4 text-sky-600" />}
      iconClassName="bg-sky-50"
    >
      {tags.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No topics yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map(({ tag, count }) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-gray-700">
              {tag}
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}
