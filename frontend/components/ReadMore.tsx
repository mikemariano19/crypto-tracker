"use client";

import { useState } from "react";

type ReadMoreProps = {
  text: string;
  maxLength?: number;
};

export default function ReadMore({
  text,
  maxLength = 500,
}: ReadMoreProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > maxLength;

  const displayedText =
    !expanded && isLong
      ? text.slice(0, maxLength) + "..."
      : text;

  return (
    <div>
      {isLong && (
        <button
        onClick={() => setExpanded(!expanded)}
        className="text-start"
        >
          {displayedText}
          <p className="text-blue-500 hover:underline">
          {expanded ? "Read less" : "Read more"}
          </p>
        </button>
      )}
    </div>
  );
}