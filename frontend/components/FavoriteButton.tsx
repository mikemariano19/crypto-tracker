"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

type FavoriteButtonProps = {
  coinId: string;
  coinName: string;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Star toggle for a coin. Safe inside clickable rows and links: it stops
 * the click from also opening the coin.
 */
export default function FavoriteButton({
  coinId,
  coinName,
  className,
  size = "sm",
}: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(coinId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${coinName} from favorites` : `Add ${coinName} to favorites`}
      title={active ? "Remove from favorites" : "Add to favorites"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(coinId);
      }}
      // Keep focus in the search box when starring from its suggestions.
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-amber-50",
        size === "sm" ? "h-6 w-6" : "h-9 w-9 border bg-white",
        className
      )}
    >
      <Star
        className={cn(
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          active ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-400"
        )}
      />
    </button>
  );
}
