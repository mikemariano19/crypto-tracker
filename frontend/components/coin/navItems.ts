import { Coins, Info, Newspaper, Wallet } from "lucide-react";

// Shared by the desktop links in NavBar and the mobile/tablet BottomNav.
export const navItems = [
  { name: "Cryptocurrency", href: "/", icon: Coins },
  { name: "Portfolio", href: "/portfolio", icon: Wallet },
  { name: "News", href: "/news", icon: Newspaper },
  { name: "About", href: "/about", icon: Info },
];

export function isNavItemActive(href: string, pathname: string): boolean {
  // Coin profiles belong to the market section they were opened from.
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/coin/");
  }

  return pathname.startsWith(href);
}
