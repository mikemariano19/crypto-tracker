import type { Metadata } from "next";

import AlertsPage from "@/components/alerts/AlertsPage";

export const metadata: Metadata = {
  title: "Alerts | Crypto Tracker",
  description: "Price alerts, market alerts and a daily brief, only the ones you turn on.",
};

export default function Alerts() {
  return <AlertsPage />;
}
