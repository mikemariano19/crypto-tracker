import { ArrowUp } from "lucide-react";

/**
 * "N new stories ↑" floating under the navbar. New stories are only loaded
 * when the reader asks, so the feed never shifts under them.
 */
export default function NewStoriesPill({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-40 flex justify-center">
      {count > 0 && (
        <button
          type="button"
          onClick={onClick}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-colors animate-in fade-in slide-in-from-top-2 hover:bg-gray-700"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          {count} new {count === 1 ? "story" : "stories"}
        </button>
      )}
    </div>
  );
}
