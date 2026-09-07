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
    <div className="flex flex-col gap-2">
      <p className="text-gray-600 leading-relaxed">
        {displayedText}
      </p>

      {isLong && (
        <button
        onClick={() => setExpanded(!expanded)}
        >
          <div className="w-full text-gray-100 p-2 mt-2 rounded-full cursor-pointer bg-gray-600 hover:bg-gray-700 transition-colors duration-300">
            {expanded ? "Show less" : "Show more"}
          </div> 
        </button>
      )}
    </div>
  );
}