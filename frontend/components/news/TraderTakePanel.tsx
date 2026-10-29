"use client";

import { useId, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";

import AiDisclaimer from "@/components/news/AiDisclaimer";
import { LEVEL_TEXT } from "@/lib/formatNews";
import type { Level, TraderTake } from "@/types/news";

/**
 * "▸ AI trader take: …" — one-line teaser, expands to the full view.
 */
export default function TraderTakePanel({
  take,
  assets,
  confidence,
}: {
  take: TraderTake;
  assets: string[];
  confidence: Level;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-lg bg-violet-50/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-violet-50"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-violet-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="shrink-0 font-semibold text-violet-700">AI trader take:</span>
        <span className={`min-w-0 text-gray-700 ${open ? "" : "truncate"}`}>{take.teaser}</span>
      </button>

      {open && (
        <div id={panelId} className="space-y-2.5 px-3 pb-3 pl-8 text-xs">
          <p className="leading-relaxed text-gray-700">{take.view}</p>

          <dl className="flex flex-wrap gap-x-5 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Assets</dt>
              <dd className="font-semibold text-gray-900">{assets.length > 0 ? assets.join(", ") : "Market-wide"}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Confidence</dt>
              <dd className="inline-flex items-center gap-1 font-semibold text-gray-900">
                <Sparkles className="h-3 w-3 text-violet-500" aria-hidden="true" />
                {LEVEL_TEXT[confidence]}
              </dd>
            </div>
          </dl>

          <AiDisclaimer />
        </div>
      )}
    </div>
  );
}
