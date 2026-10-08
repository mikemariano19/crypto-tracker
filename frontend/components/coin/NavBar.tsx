"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Coins,
  Newspaper,
  Info,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

const navItems = [
  {
    name: "Cryptocurrency",
    href: "/",
    icon: Coins,
  },
  {
    name: "News",
    href: "/news",
    icon: Newspaper,
  },
  {
    name: "About",
    href: "/about",
    icon: Info,
  },
];

export default function NavBar() {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isCryptoActive =
    pathname === "/" || pathname.startsWith("/coin/");

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


        {/* =====================================================
            DESKTOP NAVIGATION
        ====================================================== */}
        <div className="hidden md:flex items-center gap-1">

          {navItems.map((item) => {

            const Icon = item.icon;

            const isActive =
              item.href === "/"
                ? isCryptoActive
                : pathname.startsWith(item.href);

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


        {/* =====================================================
            MOBILE DROPDOWN
        ====================================================== */}
        <div
          ref={menuRef}
          className="relative md:hidden"
        >

          {/* Menu button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              border
              bg-white
              text-muted-foreground
              transition-colors
              hover:bg-muted
              active:bg-muted
              cursor-pointer
            "
          >
            {isOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>


          {/* Dropdown */}
          {isOpen && (
            <div
              className="
                absolute
                right-0
                top-11
                w-52
                overflow-hidden
                rounded-xl
                border
                bg-white
                shadow-lg
                animate-in
                fade-in
                slide-in-from-top-2
                duration-150
              "
            >

              <div className="p-1.5">

                {navItems.map((item) => {

                  const Icon = item.icon;

                  const isActive =
                    item.href === "/"
                      ? isCryptoActive
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`
                        flex
                        items-center
                        gap-3
                        rounded-lg
                        px-3
                        py-2.5
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

                      <Icon className="h-4 w-4 shrink-0" />

                      <span>
                        {item.name}
                      </span>

                    </Link>
                  );
                })}

              </div>

            </div>
          )}

        </div>

      </nav>

    </header>
  );
}