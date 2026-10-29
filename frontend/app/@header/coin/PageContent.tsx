"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function PageContent({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: React.ReactNode;
}) {
  const pathname = usePathname();
  const isProfilePage = pathname.startsWith("/coin/");

  // Coin pages render through the @profile slot swapped in here, so Next's
  // usual scroll-to-top on navigation doesn't kick in and a new coin would
  // open at the previous page's scroll position. Reset it ourselves, except
  // on Back/Forward, where the browser should restore where the user was.
  const previousPath = useRef(pathname);
  const isHistoryNavigation = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      isHistoryNavigation.current = true;
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Layout effect: runs before the browser paints, so the new page is never
  // shown (even for a frame) at the old page's scroll position.
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;

    if (isHistoryNavigation.current) {
      isHistoryNavigation.current = false;
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname]);

  return isProfilePage ? profile : children;
}
