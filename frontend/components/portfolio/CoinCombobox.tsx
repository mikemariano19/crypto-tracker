"use client";

import { useId, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useCoinOptions } from "@/hooks/useCoinOptions";
import type { SearchResult } from "@/hooks/useCoinSearch";
import { cn } from "@/lib/utils";

/**
 * Type-ahead coin picker following the ARIA combobox pattern: arrows move
 * through suggestions, Enter picks, Escape closes the list. The biggest
 * coins are suggested before anything is typed.
 */
export default function CoinCombobox({
  onSelect,
  onOpenChange,
  autoFocus,
}: {
  onSelect: (coin: SearchResult) => void;
  /** Lets a surrounding dialog ignore Escape while the list is open. */
  onOpenChange?: (open: boolean) => void;
  autoFocus?: boolean;
}) {
  const [input, setInput] = useState("");
  const [open, setOpenState] = useState(false);
  const [active, setActive] = useState(0);
  const { options, isLoading } = useCoinOptions(input);
  const listId = useId();

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  const pick = (coin: SearchResult | undefined) => {
    if (!coin) return;
    setOpen(false);
    onSelect(coin);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        // Closed: just reopen on the current suggestion. Open: move down.
        if (!open) setOpen(true);
        else setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (open && options.length > 0) {
          event.preventDefault();
          pick(options[active]);
        }
        break;
      case "Escape":
        if (open) setOpen(false);
        break;
    }
  };

  const showList = open && (options.length > 0 || isLoading || input.trim() !== "");
  const activeId = showList && options[active] ? `${listId}-${options[active].id}` : undefined;

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-sm font-medium text-gray-800">
        Coin
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Search coins, e.g. bit or SOL"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-lg border bg-white pl-9 pr-9 text-sm outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden="true" />
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Coins"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg"
        >
          {options.length === 0 && !isLoading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No coins match “{input.trim()}”.</li>
          )}
          {options.map((coin, i) => (
            <li
              key={coin.id}
              id={`${listId}-${coin.id}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: picking must happen before the input blurs.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(coin);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm",
                i === active ? "bg-gray-100" : "bg-white"
              )}
            >
              {coin.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coin.image} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 shrink-0 rounded-full" />
              ) : (
                <span className="h-5 w-5 shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{coin.name}</span>
              <span className="text-xs font-semibold uppercase text-gray-500">{coin.symbol}</span>
              {coin.market_cap_rank !== null && (
                <span className="w-10 text-right text-xs tabular-nums text-gray-500">#{coin.market_cap_rank}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
