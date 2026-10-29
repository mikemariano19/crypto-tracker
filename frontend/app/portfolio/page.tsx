import type { Metadata } from "next";
import { Suspense } from "react";

import { PortfolioSkeleton } from "@/components/portfolio/EmptyState";
import PortfolioPage from "@/components/portfolio/PortfolioPage";

export const metadata: Metadata = {
  title: "Portfolio | Crypto Tracker",
  description: "Track your crypto holdings across wallets, stored only in your browser.",
};

export default function Portfolio() {
  return (
    // The search box reads ?q= from the URL, which needs a Suspense
    // boundary so the rest of the page can still be prerendered.
    <Suspense
      fallback={
        <div className="py-4">
          <PortfolioSkeleton />
        </div>
      }
    >
      <PortfolioPage />
    </Suspense>
  );
}
