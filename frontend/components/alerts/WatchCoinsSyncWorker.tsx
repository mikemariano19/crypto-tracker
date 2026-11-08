"use client";

import { useEffect } from "react";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { useWatchCoins } from "@/hooks/useWatchCoins";
import { sameCoins } from "@/lib/watchCoins";

// Favoriting a few coins in a row should be one save, not several.
const SAVE_DELAY_MS = 2_000;

/**
 * Sends this browser's watched coins (favorites and wallet coins, IDs only)
 * to the server when they change, while big-move alerts are on. Loaded only
 * for browsers that allowed notifications, since it brings the wallet code.
 */
export default function WatchCoinsSyncWorker() {
  const { code } = useDisplayCurrency();
  const { state, updatePrefs } = usePushAlerts(code);
  const coins = useWatchCoins();
  const saved = state?.prefs.watchCoins;
  const wanted = Boolean(state?.prefs.categories.moves);

  useEffect(() => {
    if (!wanted || coins === null || !saved || sameCoins(coins, saved)) return;

    const timer = setTimeout(() => updatePrefs({ watchCoins: coins }), SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [wanted, coins, saved, updatePrefs]);

  return null;
}
