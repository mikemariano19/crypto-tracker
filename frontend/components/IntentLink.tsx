"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * next/link that prefetches on intent (hover, touch, keyboard focus) instead
 * of on entering the viewport. The default prefetches every visible link as
 * the page loads: on the home page that was ~60 requests plus other routes'
 * JS (the portfolio's zod, the alerts dialog), all parsed on the main thread
 * while a phone is still busy hydrating, which Lighthouse counts as blocking
 * time. A touch still starts the prefetch ~100 ms before the click lands.
 */
export default function IntentLink({
  prefetch,
  onPointerEnter,
  onTouchStart,
  onFocus,
  ...props
}: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  const show = () => setIntent(true);

  return (
    <Link
      {...props}
      // An explicit prefetch={false} stays off; otherwise Next's default
      // ("auto") switches on once there's intent.
      prefetch={prefetch === false || !intent ? false : prefetch}
      onPointerEnter={(event) => {
        show();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        show();
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        show();
        onFocus?.(event);
      }}
    />
  );
}
