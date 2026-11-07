import { Share, SquarePlus } from "lucide-react";
import type { PushStatus } from "@/hooks/usePushAlerts";

/** iPhone and iPad only get web push in an app added to the Home Screen. */
export function InstallGuide() {
  return (
    <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
      <p className="font-semibold text-gray-900">Install the app to get alerts on iPhone</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        <li>
          Tap <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" /> in Safari&apos;s toolbar.
        </li>
        <li>
          Choose <span className="font-medium">Add to Home Screen</span>{" "}
          <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />.
        </li>
        <li>Open Crypto Tracker from your Home Screen and set the alert there.</li>
      </ol>
      <p className="mt-2 text-xs text-gray-500">Apple only allows web notifications from apps on the Home Screen (iOS 16.4 or later).</p>
    </div>
  );
}

/**
 * Why alerts can't be turned on here, in plain words. Nothing for the
 * statuses where they can.
 */
export default function PushNotice({ status }: { status: PushStatus }) {
  switch (status) {
    case "needs-install":
      return <InstallGuide />;
    case "unsupported":
      return <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">This browser can&apos;t show notifications. Try Chrome, Edge, Firefox or Safari.</p>;
    case "denied":
      return (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then come back here.
        </p>
      );
    case "unavailable":
      return <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">Alerts aren&apos;t available right now. Please check back later.</p>;
    default:
      return null;
  }
}
