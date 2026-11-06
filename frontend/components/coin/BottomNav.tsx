"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, navItems } from "@/components/coin/navItems";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

/**
 * Main navigation on phones and tablets, in easy reach of the thumb. It slides
 * away while scrolling down to give the content the room.
 *
 * z-40 keeps it under dialogs and their overlays (z-50).
 */
export default function BottomNav() {
  const pathname = usePathname();
  const hidden = useHideOnScroll(pathname);

  return (
    <nav
      aria-label="Main"
      // A keyboard user tabbing into a hidden bar must be able to see the link.
      className={`fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-300 ease-out motion-reduce:transition-none has-[:focus-visible]:translate-y-0 lg:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto grid h-14 max-w-xl grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[10px] font-medium transition-colors min-[375px]:text-[11px] ${
                isActive ? "text-foreground" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <span className={`flex h-6 w-12 items-center justify-center rounded-full transition-colors ${isActive ? "bg-muted" : ""}`}>
                <Icon className="h-4 w-4" />
              </span>

              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
