import { ImageResponse } from "next/og";

/**
 * The app icon: the navbar's coins mark on a dark square. Full bleed, with the
 * mark inside the middle 60%, so it also works as a maskable icon that
 * Android crops into a circle or squircle.
 */
export function appIcon(size: number): ImageResponse {
  const mark = Math.round(size * 0.5);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111827",
        }}
      >
        {/* lucide "coins", the same icon as the navbar logo */}
        <svg width={mark} height={mark} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="m16.71 13.88.7.71-2.82 2.82" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
