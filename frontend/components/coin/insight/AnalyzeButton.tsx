"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

// A free Render instance sleeps when idle, so a slow first answer is normal.
const WAKING_AFTER_MS = 5_000;

type Props = {
  isRunning: boolean;
  /** A shared result already exists, so clicking costs nothing and is instant. */
  isReady: boolean;
  onClick: () => void;
};

export default function AnalyzeButton({ isRunning, isReady, onClick }: Props) {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setTimeout(() => setIsWaking(true), WAKING_AFTER_MS);

    return () => {
      clearTimeout(timer);
      setIsWaking(false);
    };
  }, [isRunning]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isRunning}
        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        )}

        {isRunning ? "Analyzing chart…" : "AI Analyze"}

        {isReady && !isRunning && (
          <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-bold">Ready</span>
        )}
      </button>

      {isRunning && isWaking && (
        <p role="status" className="text-[11px] text-muted-foreground">
          Waking up server… this can take up to a minute
        </p>
      )}
    </div>
  );
}
