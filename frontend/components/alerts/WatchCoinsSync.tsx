"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// The worker brings the wallet code (zod, decimal.js), so it's a separate
// download that only browsers with notifications allowed ever fetch.
const WatchCoinsSyncWorker = dynamic(() => import("@/components/alerts/WatchCoinsSyncWorker"), { ssr: false });

const noSubscribe = () => () => {};

function permissionGranted(): boolean {
  try {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

/**
 * Keeps the server's copy of this browser's watched coins (favorites and
 * wallet coins, IDs only) in step, while big-move alerts are on. Browsers
 * that never allowed notifications don't load anything.
 */
export default function WatchCoinsSync() {
  const granted = useSyncExternalStore(noSubscribe, permissionGranted, () => false);

  return granted ? <WatchCoinsSyncWorker /> : null;
}
