"use client";

import useSWR from "swr";
import { RefreshCw } from "lucide-react";

import CoinProfileView, { CoinProfileSkeleton } from "@/components/coin/CoinProfileView";
import { apiUrl, fetchApi } from "@/lib/api";
import type { CoinProfile } from "@/types/crypto";

const LIVE_REFRESH_MS = 30_000;

function updatedAt(coin: CoinProfile | undefined) {
  return coin?.last_updated ? new Date(coin.last_updated).getTime() : 0;
}

/**
 * Keeps the coin profile live: starts from the server-rendered data (when
 * the server got it) and polls for fresh prices. If the server couldn't
 * load the coin, shows cached data or a retrying notice instead.
 */
export default function CoinProfileLive({
  id,
  initial,
}: {
  id: string;
  initial?: CoinProfile;
}) {
  const { data, isValidating, mutate } = useSWR<CoinProfile>(
    apiUrl(`/api/coin/${encodeURIComponent(id)}`),
    fetchApi,
    {
      fallbackData: initial,
      refreshInterval: LIVE_REFRESH_MS,
      revalidateOnFocus: true,
      keepPreviousData: true,
      errorRetryInterval: 10_000,
    }
  );

  // localStorage may hold an older copy than the server just rendered.
  const coin = updatedAt(initial) > updatedAt(data) ? initial : data;

  if (coin) {
    return <CoinProfileView coin={coin} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span>Live market data is busy right now. Retrying automatically…</span>

        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
          Try again
        </button>
      </div>

      <CoinProfileSkeleton />
    </div>
  );
}
