"use client";

import InstallSteps from "@/components/install/InstallSteps";
import Modal from "@/components/portfolio/Modal";
import type { BrowserName, InstallGuide } from "@/lib/install";

/**
 * The written install steps in a dialog. Its own file so the dialog code
 * (Radix) only downloads when someone taps Install, not with every page.
 */
export default function InstallDialog({ guide, browser, onClose }: { guide: InstallGuide; browser: BrowserName; onClose: () => void }) {
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title="Install Crypto Tracker"
      description="Open it like an app, in its own window, with price alerts on this device."
    >
      <InstallSteps guide={guide} browser={browser} />
    </Modal>
  );
}
