const PULSE = "animate-pulse rounded bg-muted";

export function HeaderSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm" aria-hidden="true">
      <div className={`mb-4 hidden h-5 w-48 sm:block ${PULSE}`} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`mx-auto h-24 w-32 rounded-xl sm:mx-0 ${PULSE}`} />
        <div className="flex flex-1 flex-col gap-3">
          <div className={`h-2.5 w-full rounded-full ${PULSE}`} />
          <div className={`h-14 w-full rounded-lg ${PULSE}`} />
          <div className={`h-10 w-full rounded-lg ${PULSE}`} />
        </div>
      </div>
    </div>
  );
}

export function StoryCardSkeleton() {
  return (
    <div className="rounded-xl border border-l-4 border-l-gray-200 bg-white p-4 shadow-sm sm:p-5" aria-hidden="true">
      <div className="mb-3 flex gap-3">
        <div className={`h-4 w-24 rounded-full ${PULSE}`} />
        <div className={`h-4 w-20 ${PULSE}`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-5">
        <div className="flex flex-col gap-2">
          <div className={`aspect-2/1 w-full rounded-xl sm:aspect-16/10 ${PULSE}`} />
          <div className={`h-3 w-32 ${PULSE}`} />
          <div className={`h-4 w-11/12 ${PULSE}`} />
          <div className={`h-4 w-2/3 ${PULSE}`} />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className={`h-3.5 w-full ${PULSE}`} />
          <div className={`h-3.5 w-5/6 ${PULSE}`} />
          <div className={`h-3.5 w-3/4 ${PULSE}`} />
          <div className={`mt-1 h-5 w-full rounded-full ${PULSE}`} />
          <div className={`h-8 w-full rounded-lg ${PULSE}`} />
        </div>
      </div>
    </div>
  );
}

/**
 * Same footprint as the loaded page (header + 6 cards), so nothing jumps.
 */
export default function NewsSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading news">
      {withHeader && <HeaderSkeleton />}
      {Array.from({ length: 6 }).map((_, index) => (
        <StoryCardSkeleton key={index} />
      ))}
    </div>
  );
}
