import type { Metadata } from "next";
import { Suspense } from "react";

import NewsPage from "@/components/news/NewsPage";
import NewsSkeleton from "@/components/news/NewsSkeleton";

export const metadata: Metadata = {
  title: "Crypto News & Sentiment | Crypto Tracker",
  description: "Market-moving crypto news with AI sentiment and trader takes.",
};

export default function News() {
  return (
    // NewsPage reads its filters from the URL, which needs a Suspense
    // boundary so the rest of the page can still be prerendered.
    <Suspense
      fallback={
        <div className="py-4">
          <NewsSkeleton />
        </div>
      }
    >
      <NewsPage />
    </Suspense>
  );
}
