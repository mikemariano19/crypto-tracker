"use client";

import { useState } from "react";
import { formatMoney, type AllocationSlice } from "@/lib/portfolio";
import type { Currency } from "@/lib/wallet/schema";

// Categorical slots 1–5 in their validated order, then a neutral for "Other".
// Light-mode only, like the rest of the app.
const SLOT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const OTHER_COLOR = "#b4b2ab";

const colorFor = (slice: AllocationSlice, index: number) =>
  slice.key === "other" ? OTHER_COLOR : SLOT_COLORS[index % SLOT_COLORS.length];

/**
 * Share of the portfolio by coin (top 5 + Other) as one stacked bar, with a
 * legend that names every slice and its percentage.
 */
export default function AllocationBar({ slices, currency }: { slices: AllocationSlice[]; currency: Currency }) {
  const [active, setActive] = useState<string | null>(null);

  if (slices.length === 0) return null;

  const hovered = slices.find((slice) => slice.key === active);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        {/* 2px surface gaps between segments; rounded only at the ends */}
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={describe(slices)}>
          {slices.map((slice, i) => (
            <div
              key={slice.key}
              onMouseEnter={() => setActive(slice.key)}
              onMouseLeave={() => setActive(null)}
              className="h-full min-w-1 transition-opacity"
              style={{
                width: `${slice.percent}%`,
                background: colorFor(slice, i),
                opacity: active && active !== slice.key ? 0.45 : 1,
              }}
            />
          ))}
        </div>

        {hovered && (
          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow">
            <span className="font-semibold">{hovered.label}</span> · {formatMoney(hovered.value, currency)} ·{" "}
            {percentText(hovered)}
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {slices.map((slice, i) => (
          <li
            key={slice.key}
            className="flex items-center gap-1.5"
            onMouseEnter={() => setActive(slice.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(slice, i) }} aria-hidden="true" />
            <span className="font-semibold text-gray-800">{slice.label}</span>
            <span className="tabular-nums">{percentText(slice)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A real holding that rounds to 0% still exists; say so.
const percentText = (slice: AllocationSlice) => (slice.percent === 0 ? "<1%" : `${slice.percent}%`);

function describe(slices: AllocationSlice[]): string {
  return `Allocation: ${slices.map((slice) => `${slice.label} ${percentText(slice)}`).join(", ")}`;
}
