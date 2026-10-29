import Link from "next/link";
import { SearchX } from "lucide-react";

import CoinProfileLive from "@/components/coin/CoinProfileLive";
import type { CoinProfile } from "@/types/crypto";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type LoadResult =
  | { status: "ok"; coin: CoinProfile }
  | { status: "not-found" }
  | { status: "unavailable" };

async function loadCoin(id: string): Promise<LoadResult> {
  try {
    const res = await fetch(
      // The server talks to Laravel directly; the browser goes through the /api rewrite.
      `${process.env.API_BACKEND_URL ?? "http://localhost:8000"}/api/coin/${encodeURIComponent(id)}`,
      {
        // Reuse the response across visitors for a minute; the API already
        // caches CoinGecko, this saves the round trip too.
        next: { revalidate: 30 },
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      }
    );

    if (res.status === 404 || res.status === 422) {
      return { status: "not-found" };
    }

    const json = await res.json();

    return res.ok && json.success && json.data
      ? { status: "ok", coin: json.data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export default async function CoinProfilePage({ params }: Props) {
  const { id } = await params;
  const result = await loadCoin(id);

  return (
    <main className="mt-4 w-full pb-10">
      {/* Server data renders immediately, then the client keeps it live.
          If the server couldn't load it, the client retries on its own. */}
      {result.status === "ok" && <CoinProfileLive id={id} initial={result.coin} />}
      {result.status === "unavailable" && <CoinProfileLive id={id} />}

      {result.status === "not-found" && (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-4 py-16 text-center shadow-sm">
          <SearchX className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-bold">Coin not found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            We couldn&apos;t find a coin called &ldquo;{id}&rdquo;. It may have been
            delisted or the link may be wrong.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Back to market
          </Link>
        </div>
      )}
    </main>
  );
}
