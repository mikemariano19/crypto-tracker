"use client";

import { useEffect, useState } from "react";

// Smaller moves are finger jitter or the tail of a fling; reacting to them
// would make the bar flicker.
const MIN_SCROLL_DELTA = 8;

// Close to the top there is nothing to make room for, so the bar stays.
const TOP_ZONE = 56;

/**
 * True while the user is scrolling down the page. Scrolling up, reaching
 * either end of the page, or changing `resetKey` brings the bar back, so
 * navigation is never out of reach on a page that can't scroll any further.
 */
export function useHideOnScroll(resetKey: string): boolean {
  const [hidden, setHidden] = useState(false);
  const [lastKey, setLastKey] = useState(resetKey);

  // A new page starts with the bar showing, even if its scroll position
  // didn't change and so no scroll event fires.
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setHidden(false);
  }

  useEffect(() => {
    const measure = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

      // iOS rubber-banding reports positions past both ends of the page.
      return { y: Math.min(Math.max(window.scrollY, 0), max), max };
    };

    let lastY = measure().y;

    const onScroll = () => {
      const { y, max } = measure();

      if (y <= TOP_ZONE || y >= max - 1) {
        lastY = y;
        setHidden(false);
        return;
      }

      // lastY only moves on a real change, so a slow scroll still adds up.
      if (Math.abs(y - lastY) < MIN_SCROLL_DELTA) {
        return;
      }

      setHidden(y > lastY);
      lastY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
