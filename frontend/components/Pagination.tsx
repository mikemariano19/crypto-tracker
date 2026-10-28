"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Called on hover/focus so the page can start loading before the click.
  onPrefetch?: (page: number) => void;
};

/**
 * Page numbers to show, with "…" gaps: 1 … 4 5 6 … 20.
 */
function pageItems(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: (number | "gap")[] = [];

  sorted.forEach((p, index) => {
    const previous = sorted[index - 1];

    if (previous !== undefined && p - previous === 2) {
      items.push(previous + 1); // a gap of one page: show it instead of "…"
    } else if (previous !== undefined && p - previous > 2) {
      items.push("gap");
    }

    items.push(p);
  });

  return items;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  onPrefetch,
}: PaginationProps) {
  const button =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";

  const goTo = (target: number) => ({
    onClick: () => onPageChange(target),
    onMouseEnter: () => onPrefetch?.(target),
    onFocus: () => onPrefetch?.(target),
  });

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={page <= 1}
        aria-label="Previous page"
        className={`${button} text-gray-600 hover:bg-gray-100`}
        {...goTo(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="ml-0.5 hidden sm:inline">Prev</span>
      </button>

      {/* Full page list from sm up; a compact "3 / 20" on phones */}
      <div className="hidden items-center gap-1 sm:flex">
        {pageItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={`${button} ${
                item === page
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              {...goTo(item)}
            >
              {item}
            </button>
          )
        )}
      </div>

      <span className="px-3 text-sm font-medium text-gray-600 sm:hidden">
        {page} / {totalPages}
      </span>

      <button
        type="button"
        disabled={page >= totalPages}
        aria-label="Next page"
        className={`${button} text-gray-600 hover:bg-gray-100`}
        {...goTo(page + 1)}
      >
        <span className="mr-0.5 hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
