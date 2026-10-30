"use client";

import { useEffect, useRef } from "react";

// Same shades as the price-change text (green-700 / red-600), which pass
// 4.5:1 contrast on white, so the number stays readable mid-flash.
const UP_COLOR = "oklch(52.7% 0.154 150.069)";
const DOWN_COLOR = "oklch(57.7% 0.245 27.325)";

// Holds the colour briefly, then fades back to the text's own colour.
const FLASH_MS = 2_000;
const HOLD = 0.2;

/**
 * Wraps a live number and briefly tints it green when it goes up or red
 * when it goes down. Only real changes flash: not the first render, and not
 * a row that just mounted (e.g. after switching table pages).
 */
export default function PriceFlash({
  value,
  className,
  children,
}: {
  value: number | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;

    const element = ref.current;
    if (before == null || value == null || before === value) return;
    if (!element || typeof element.animate !== "function") return;

    const color = value > before ? UP_COLOR : DOWN_COLOR;

    // No end keyframe: the browser fades to the element's normal colour,
    // whatever the surrounding styles make it. A new change restarts it.
    element.getAnimations().forEach((animation) => animation.cancel());
    element.animate(
      [
        { color, offset: 0 },
        { color, offset: HOLD },
      ],
      { duration: FLASH_MS, easing: "ease-out" }
    );
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
