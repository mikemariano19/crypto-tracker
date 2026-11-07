import type { MetadataRoute } from "next";

// Makes the site installable. On an iPhone, web push only works once the app
// has been added to the Home Screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crypto Tracker",
    short_name: "CryptoTracker",
    description: "Crypto prices, news sentiment and the alerts you choose.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#111827",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
