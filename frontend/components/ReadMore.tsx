"use client";

import { useState } from "react";

type ReadMoreProps = {
  text: string;
  maxLength?: number;
};

/**
 * Long text cut to `maxLength` with an inline "more". Clicking anywhere in
 * the text expands or collapses it, so it can be closed again without
 * scrolling to the end.
 */
export default function ReadMore({
  text,
  maxLength = 500,
}: ReadMoreProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > maxLength;

  if (!isLong) {
    return <p className="text-gray-600 leading-relaxed">{text}</p>;
  }

  const toggle = () => {
    // Selecting text to copy it shouldn't collapse the paragraph.
    if (window.getSelection()?.toString()) return;
    setExpanded((open) => !open);
  };

  return (
    <p
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setExpanded((open) => !open);
        }
      }}
      title={expanded ? "Click to collapse" : "Click to read more"}
      className="cursor-pointer rounded-md text-gray-600 leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
    >
      {expanded ? text : `${text.slice(0, maxLength).trimEnd()}… `}
      <span className="font-semibold text-gray-900 hover:underline">
        {expanded ? " less" : "more"}
      </span>
    </p>
  );
}
