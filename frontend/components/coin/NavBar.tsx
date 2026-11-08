"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Coins } from "lucide-react";
import { isNavItemActive, navItems } from "@/components/coin/navItems";
import InstallButton from "@/components/install/InstallButton";
import ThemeToggle from "@/components/ThemeToggle";

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">

      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-4">

        {/* =====================================================
            LOGO
        ====================================================== */}
        <Link
          href="/"
          className="
            flex
            items-center
            gap-2
            shrink-0
            transition-opacity
            hover:opacity-80
          "
        >
          <div
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              bg-foreground
              text-background
            "
          >
            <Coins className="h-4 w-4" />
          </div>

          <div className="flex flex-col leading-none">

            <span className="text-base font-bold tracking-tight">
              CryptoTracker
            </span>

            <span className="hidden sm:block text-[9px] text-muted-foreground uppercase tracking-wide">
              Market Dashboard
            </span>

          </div>
        </Link>


        <div className="flex items-center gap-2">

        {/* =====================================================
            DESKTOP NAVIGATION (BottomNav takes over below lg)
        ====================================================== */}
        <div className="hidden lg:flex items-center gap-1">

          {navItems.map((item) => {

            const Icon = item.icon;

            const isActive = isNavItemActive(item.href, pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex
                  items-center
                  gap-2
                  rounded-lg
                  px-3
                  py-2
                  text-sm
                  font-medium
                  transition-colors
                  ${
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }
                `}
              >
                <Icon className="h-4 w-4" />

                {item.name}
              </Link>
            );
          })}

        </div>


        <InstallButton />

        {/* Settings and the history of sent alerts, for anyone who missed one. */}
        <Link
          href="/alerts"
          aria-label="Alerts"
          title="Alerts"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-gray-100 ${
            pathname.startsWith("/alerts") ? "text-gray-900" : "text-gray-500"
          }`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Link>

        <ThemeToggle />

        </div>

      </nav>

    </header>
  );
}
