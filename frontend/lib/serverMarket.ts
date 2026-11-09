// Server-only: the home page's first page of coins, fetched while the page is
// prerendered so the table's rows are already in the HTML. The browser no
// longer waits for JS, then a round trip to the backend, before rows appear,
// which matters most far from the backend (Europe, Asia).
import type { CryptoPrice } from "@/hooks/useCryptoPrices";

const BACKEND_URL = process.env.API_BACKEND_URL ?? "http://localhost:8000";

// Matches the client's 30 s polling closely enough: the client revalidates
// on mount anyway, so the HTML only has to be a recent first paint.
const REVALIDATE_SECONDS = 60;

// A sleeping free Render instance can take a minute to wake. Builds and
// background revalidation shouldn't hang on it.
const TIMEOUT_MS = 15_000;

/**
 * Page 1 of the market table, or null when the page should fall back to the
 * skeleton (backend unreachable during a build, or in development).
 */
export async function getTopCoins(): Promise<CryptoPrice[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/coin`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json()) as { success?: boolean; data?: unknown };

    if (!res.ok || !json.success || !Array.isArray(json.data) || json.data.length === 0) {
      throw new Error(`Coin list request failed (${res.status})`);
    }

    return json.data as CryptoPrice[];
  } catch (error) {
    // A failed background revalidation must throw: Next then keeps serving
    // the last good page instead of caching a skeleton for a minute. A build
    // must not fail just because the backend is asleep, and development
    // shouldn't need the backend running to show the page.
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    if (isBuild || process.env.NODE_ENV !== "production") {
      console.warn("Prerendering the market table without data:", error);
      return null;
    }
    throw error;
  }
}
