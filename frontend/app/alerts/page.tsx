import type { Metadata } from "next";

import AlertsPage from "@/components/alerts/AlertsPage";

export const metadata: Metadata = {
  title: "Price alerts | Crypto Tracker",
  description: "Get notified when a coin rises above or drops below a price. Saved only in your browser.",
};

export default function Alerts() {
  return <AlertsPage />;
}
