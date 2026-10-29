import { Newspaper } from "lucide-react";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-white px-4 py-12 text-center">
      <Newspaper className="h-8 w-8 text-gray-300" />
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
