"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import FavoriteButton from "@/components/FavoriteButton";
import { useCoinSearch, type SearchResult } from "@/hooks/useCoinSearch";
import { cn } from "@/lib/utils";

// next.config only allows CoinGecko's coin image host; some search results
// point elsewhere (e.g. a "missing image" placeholder).
function isAllowedImage(url: string | null): url is string {
  return !!url && url.startsWith("https://coin-images.coingecko.com/coins/images/");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const start = text.toLowerCase().indexOf(query.toLowerCase());

  if (!query || start === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-amber-100 px-0.5 text-inherit">
        {text.slice(start, start + query.length)}
      </mark>
      {text.slice(start + query.length)}
    </>
  );
}

/**
 * Type-ahead coin search: suggestions appear as you type ("bit" → Bitcoin),
 * and choosing one opens that coin. Press "/" anywhere to jump here.
 */
export default function CoinSearch({ className }: { className?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const { results, isSearching } = useCoinSearch(input);
  const typed = input.trim();
  const showPanel = open && typed.length > 0;
  const activeIndex = Math.min(active, results.length - 1);

  // "/" focuses the search unless the user is already typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const choose = (coin: SearchResult) => {
    setOpen(false);
    setInput("");
    inputRef.current?.blur();
    router.push(`/coin/${coin.id}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      const coin = results[activeIndex];
      if (coin) {
        event.preventDefault();
        choose(coin);
      }
    } else if (event.key === "Escape") {
      if (input) {
        setInput("");
      } else {
        inputRef.current?.blur();
      }
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search coins"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={
          showPanel && results[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        placeholder="Search coins, e.g. bitcoin or ETH"
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-lg border bg-white pl-9 pr-16 text-sm shadow-sm outline-none transition-shadow placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
      />

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {typed && isSearching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}

        {input ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setInput("");
              inputRef.current?.focus();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden rounded border bg-gray-50 px-1.5 text-[11px] font-medium text-gray-400 sm:block">
            /
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border bg-white shadow-lg">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Coin suggestions" className="max-h-96 overflow-y-auto py-1">
              {results.map((coin, index) => (
                <li
                  key={coin.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // Keep focus in the input so the list doesn't close mid-click.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(coin)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2",
                    index === activeIndex && "bg-gray-50"
                  )}
                >
                  {isAllowedImage(coin.image) ? (
                    <Image
                      src={coin.image}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded-full"
                    />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      <Highlight text={coin.name} query={typed} />
                    </p>
                    <p className="text-[11px] uppercase text-gray-400">
                      <Highlight text={coin.symbol} query={typed} />
                    </p>
                  </div>

                  {coin.market_cap_rank && (
                    <span className="shrink-0 text-[11px] text-gray-400">
                      #{coin.market_cap_rank}
                    </span>
                  )}

                  <FavoriteButton coinId={coin.id} coinName={coin.name} />
                </li>
              ))}
            </ul>
          ) : (
            <p id={listId} className="px-3 py-4 text-center text-sm text-gray-500">
              {isSearching ? "Searching…" : <>No coins found for &ldquo;{typed}&rdquo;</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
