"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type NavSection = { id: string; label: string };

// A section counts as current once its heading has scrolled up past this
// line (just under the sticky bars), so the highlight follows the reader.
const ACTIVE_LINE_PX = 140;

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current: string | null = null;

      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= ACTIVE_LINE_PX) current = id;
      }

      // Short last sections never reach the line; at the very bottom, the last one is current.
      setActive(atBottom ? (ids.at(-1) ?? null) : current);
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);

  return active;
}

/**
 * "On this page" links: a sticky list beside the content on desktop, a
 * sticky row of scrollable chips under the nav bar on smaller screens.
 * Plain anchor links, so it works before JavaScript loads; the script only
 * adds the highlight of the section being read.
 */
export default function SectionNav({ sections }: { sections: NavSection[] }) {
  const ids = useMemo(() => sections.map((section) => section.id), [sections]);
  const active = useActiveSection(ids);
  const chipRow = useRef<HTMLUListElement>(null);

  // Keep the current chip visible in the row. Scrolls the row only, never the page.
  useEffect(() => {
    const row = chipRow.current;
    const chip = active ? row?.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
    if (!row || !chip || row.offsetParent === null) return;

    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left) });
  }, [active]);

  return (
    <nav aria-label="On this page" className="sticky top-14 z-40 lg:top-20 lg:z-auto lg:self-start">
      {/* Phone & tablet: chips */}
      <div className="-mx-3 border-b bg-gray-50/95 px-3 py-1 backdrop-blur sm:-mx-4 sm:px-4 lg:hidden">
        <ul ref={chipRow} className="flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                data-section={section.id}
                aria-current={active === section.id ? "location" : undefined}
                className={cn(
                  "block rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                  active === section.id
                    ? "bg-foreground text-background ring-foreground"
                    : "bg-white text-muted-foreground ring-foreground/10 hover:text-foreground"
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: side list */}
      <div className="hidden lg:block">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
        <ul className="space-y-0.5 border-l">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l-2 px-3 py-1 text-sm transition-colors",
                  active === section.id
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
