"use client";

import { Moon, Sun } from "lucide-react";
import { isDarkNow, useIsDark } from "@/hooks/useIsDark";
import { setTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const dark = useIsDark();

  return (
    <button
      type="button"
      onClick={() => setTheme(isDarkNow() ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {/* Icons switch with CSS so they are right before hydration too */}
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
