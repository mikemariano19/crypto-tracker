"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Download } from "lucide-react";
import { useInstallApp } from "@/hooks/useInstallApp";
import { currentBrowser, installGuide, type BrowserName, type InstallGuide } from "@/lib/install";
import { cn } from "@/lib/utils";

// The header is on every page, so the dialog downloads only when it's opened.
const InstallDialog = dynamic(() => import("@/components/install/InstallDialog"), { ssr: false });

/**
 * Install button in the header, for phones and tablets: laptop and desktop
 * users rarely install web apps, and their browsers offer it anyway.
 * Chromium browsers (Chrome, Brave, Edge, Opera, Samsung Internet) install
 * with one click; Safari and Firefox get the steps for their menus. Hidden
 * inside the installed app.
 */
export default function InstallButton({ className }: { className?: string }) {
  const { state, install } = useInstallApp();
  const [steps, setSteps] = useState<{ guide: InstallGuide; browser: BrowserName } | null>(null);

  if (state === null || state === "installed") return null;

  const onClick = async () => {
    // One click in Chromium browsers; the steps if the browser won't prompt.
    if (state === "prompt" && (await install()) !== "failed") return;

    const browser = currentBrowser();
    setSteps({ guide: installGuide(navigator.userAgent, navigator.maxTouchPoints ?? 0, browser), browser });
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Install the app"
        title="Install the app"
        className={cn(
          // Phones and tablets only: below the laptop layout, or any touch-first
          // screen (a tablet held sideways gets the laptop layout but is still a tablet).
          "hidden h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 max-lg:inline-flex pointer-coarse:inline-flex",
          className,
        )}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </button>

      {steps && <InstallDialog guide={steps.guide} browser={steps.browser} onClose={() => setSteps(null)} />}
    </>
  );
}
