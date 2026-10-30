import { ImageResponse } from "next/og";
import { about } from "@/content/about";

// Drawn once at build time from the About content (no request-time APIs),
// so it costs nothing to serve and stays in sync with the tagline. Uses the
// regular-weight font bundled with Next, so the build needs no font download.
export const alt = `About ${about.app.name}: ${about.app.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const features = about.features.filter((feature) => feature.enabled).map((feature) => feature.title);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f9fafb",
          color: "#0a0a0a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#0a0a0a",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            {about.app.name.charAt(0)}
          </div>
          <div style={{ display: "flex", fontSize: 44 }}>{about.app.name}</div>
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              padding: "8px 20px",
              borderRadius: 999,
              border: "2px solid #e5e7eb",
              background: "#ffffff",
              fontSize: 24,
              color: "#525252",
            }}
          >
            {about.app.badge}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 64, lineHeight: 1.15, letterSpacing: -1 }}>{about.app.tagline}</div>

        <div style={{ display: "flex", gap: 16 }}>
          {features.map((title) => (
            <div
              key={title}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 12,
                background: "#ffffff",
                border: "2px solid #e5e7eb",
                fontSize: 26,
                color: "#262626",
              }}
            >
              {title}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
