"use client";

import { useSyncExternalStore } from "react";

// One shared 1s clock for every "updated X ago" label on the page.
let now = 0;

function subscribe(onTick: () => void) {
  now = Date.now();
  const timer = setInterval(() => {
    now = Date.now();
    onTick();
  }, 1000);

  return () => clearInterval(timer);
}

function formatAgo(seconds: number) {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * "Updated 12s ago" with a live dot. Renders nothing on the server so the
 * relative time can't cause a hydration mismatch.
 */
export default function UpdatedAgo({ timestamp }: { timestamp: string | null }) {
  const current = useSyncExternalStore(subscribe, () => now, () => 0);

  if (!timestamp || !current) return null;

  const updatedAt = new Date(timestamp).getTime();
  if (Number.isNaN(updatedAt)) return null;

  const seconds = Math.max(0, Math.floor((current - updatedAt) / 1000));
  // CoinGecko refreshes prices every minute or so; older than 5m is stale.
  const isFresh = seconds < 300;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {isFresh && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            isFresh ? "bg-green-500" : "bg-amber-400"
          }`}
        />
      </span>
      Updated {formatAgo(seconds)}
    </span>
  );
}
