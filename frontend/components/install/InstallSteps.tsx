import { EllipsisVertical, Menu, MonitorDown, Share, SquarePlus } from "lucide-react";
import { BROWSER_LABELS, type BrowserName, type InstallGuide } from "@/lib/install";

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="flex flex-col gap-2.5">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-gray-700">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

const icon = "mx-0.5 inline h-4 w-4 align-text-bottom";

/** The browser menu's icon, so people know what to look for. */
function MenuIcon({ browser }: { browser: BrowserName }) {
  return browser === "brave" || browser === "samsung" || browser === "opera"
    ? <Menu className={icon} aria-label="menu" />
    : <EllipsisVertical className={icon} aria-label="menu" />;
}

/**
 * How to install the app where the browser has no one-click install:
 * Safari, Firefox, and Chromium browsers that haven't offered it yet.
 */
export default function InstallSteps({ guide, browser }: { guide: InstallGuide; browser: BrowserName }) {
  const name = BROWSER_LABELS[browser];

  switch (guide) {
    case "ios":
      return (
        <Steps>
          <Step n={1}>
            Tap <Share className={icon} aria-label="Share" /> Share.{" "}
            {browser === "safari" ? "It's in Safari's toolbar." : `In ${name} it's in or next to the address bar.`}
          </Step>
          <Step n={2}>
            Scroll down and tap <span className="font-semibold text-gray-900">Add to Home Screen</span> <SquarePlus className={icon} aria-hidden="true" />.
          </Step>
          <Step n={3}>Tap <span className="font-semibold text-gray-900">Add</span>, then open Crypto Tracker from your Home Screen.</Step>
        </Steps>
      );

    case "safari-mac":
      return (
        <Steps>
          <Step n={1}>In the menu bar, choose <span className="font-semibold text-gray-900">File → Add to Dock</span>.</Step>
          <Step n={2}>Click <span className="font-semibold text-gray-900">Add</span>. Crypto Tracker opens from the Dock in its own window.</Step>
          <p className="text-xs text-gray-500">Needs macOS Sonoma (Safari 17) or later.</p>
        </Steps>
      );

    case "firefox-android":
      return (
        <Steps>
          <Step n={1}>Tap the <EllipsisVertical className={icon} aria-label="menu" /> menu.</Step>
          <Step n={2}>Tap <span className="font-semibold text-gray-900">Add app to Home screen</span> (or <span className="font-semibold text-gray-900">Install</span>).</Step>
          <Step n={3}>Tap <span className="font-semibold text-gray-900">Add</span>.</Step>
        </Steps>
      );

    case "firefox-desktop":
      return (
        <p className="text-sm text-gray-700">
          Firefox on computers can&apos;t install web apps yet. Open this site in <span className="font-semibold text-gray-900">Chrome, Edge or Brave</span>{" "}
          to install it, or bookmark it in Firefox. On Android, Firefox can install it.
        </p>
      );

    case "chromium-android":
      return (
        <Steps>
          <Step n={1}>Tap the <MenuIcon browser={browser} /> menu in {name}.</Step>
          <Step n={2}>
            Tap <span className="font-semibold text-gray-900">Install app</span> or <span className="font-semibold text-gray-900">Add to Home screen</span>
            {browser === "samsung" && <> (under <span className="font-semibold text-gray-900">Add page to</span>)</>}.
          </Step>
          <Step n={3}>Tap <span className="font-semibold text-gray-900">Install</span>.</Step>
        </Steps>
      );

    case "chromium-desktop":
      return (
        <Steps>
          <Step n={1}>
            Click the install icon <MonitorDown className={icon} aria-hidden="true" /> at the right end of {name}&apos;s address bar.
          </Step>
          <Step n={2}>
            No icon? Open the <MenuIcon browser={browser} /> menu and choose{" "}
            {browser === "edge"
              ? <span className="font-semibold text-gray-900">Apps → Install this site as an app</span>
              : <span className="font-semibold text-gray-900">Install page as app</span>}
            {browser === "chrome" && <> (under <span className="font-semibold text-gray-900">Cast, save and share</span>)</>}.
          </Step>
          <Step n={3}>Click <span className="font-semibold text-gray-900">Install</span>. Crypto Tracker opens in its own window.</Step>
        </Steps>
      );
  }
}
