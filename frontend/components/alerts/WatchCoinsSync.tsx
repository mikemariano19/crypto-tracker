"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { useWatchCoins } from "@/hooks/useWatchCoins";
import { sameCoins } from "@/lib/watchCoins";

// Favoriting a few coins in a row should be one save, not several.
const SAVE_DELAY_MS = 2_000;

const noSubscribe = () => () => {};

function permissionGranted(): boolean {
  try {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

function Sync() {
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

/**
 * Keeps the server's copy of this browser's watched coins (favorites and
 * wallet coins, IDs only) in step, while big-move alerts are on. Browsers
 * that never allowed notifications don't load anything.
 */
export default function WatchCoinsSync() {
  const granted = useSyncExternalStore(noSubscribe, permissionGranted, () => false);

  return granted ? <Sync /> : null;
}
