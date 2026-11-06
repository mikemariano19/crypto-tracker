"use client";

import ExternalLink from "@/components/ExternalLink";
import { SentimentIcon } from "@/components/news/SentimentBadge";
import { LABEL_TEXT, SENTIMENT_STYLES, formatRelativeTime } from "@/lib/formatNews";
import { useNow } from "@/hooks/useNow";
import type { NewsPin } from "@/types/insight";

// A pin's own hover can't be reached by touch or keyboard, so the same stories
// are listed here, as ordinary links.
export default function NewsPinList({ pins }: { pins: NewsPin[] }) {
  const now = useNow();

  if (pins.length === 0) return null;

  const newestFirst = [...pins].sort((a, b) => b.time - a.time);

  return (
    <details className="group">
      <summary className="text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-gray-900">
        News on this chart ({pins.length})
      </summary>

      <ul className="mt-2 flex flex-col gap-2">
        {newestFirst.map((pin) => (
          <li key={pin.url} className="text-xs">
            <ExternalLink href={pin.url} className="font-medium text-gray-900 hover:underline">
              {pin.headline}
            </ExternalLink>

            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
              <span className={`inline-flex items-center gap-1 font-semibold ${SENTIMENT_STYLES[pin.label].text}`}>
                <SentimentIcon label={pin.label} />
                {LABEL_TEXT[pin.label]}
              </span>
              <span>· {pin.source}</span>
              {now > 0 && <span>· {formatRelativeTime(new Date(pin.time * 1000).toISOString(), now)}</span>}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
