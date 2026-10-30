"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The outlet's site icon before its name. Falls back to an initial tile when
 * there's no icon or it fails to load.
 */
export default function SourceMark({
  name,
  iconUrl = null,
  className,
}: {
  name: string;
  iconUrl?: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (iconUrl && failedUrl !== iconUrl) {
    return (
      // Icons live on each outlet's own site, so a plain <img> (not next/image).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt=""
        width={16}
        height={16}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(iconUrl)}
        className={cn("h-4 w-4 shrink-0 rounded-lg bg-white object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-[9px] font-bold uppercase text-white",
        className
      )}
    >
      {name.trim().charAt(0)}
    </span>
  );
}
