"use client";

import { useId, useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search } from "lucide-react";
import type { FiatCurrency } from "@/hooks/useExchangeRates";
import { cn } from "@/lib/utils";

// Shown first, in this order, before anything is typed.
const POPULAR = ["usd", "eur", "gbp", "jpy", "php", "cny", "inr", "krw", "aud", "cad", "sgd", "idr"];

/** Code first ("eu" → EUR), then name ("peso" → every peso). */
export function matchCurrencies(currencies: readonly FiatCurrency[], query: string): FiatCurrency[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    const popular = POPULAR.flatMap((code) => currencies.filter((currency) => currency.code === code));
    const rest = currencies.filter((currency) => !POPULAR.includes(currency.code)).sort((a, b) => a.name.localeCompare(b.name));
    return [...popular, ...rest];
  }

  const byCode = currencies.filter((currency) => currency.code.startsWith(q));
  const byName = currencies.filter((currency) => !currency.code.startsWith(q) && currency.name.toLowerCase().includes(q));
  return [...byCode, ...byName];
}

/**
 * Button showing the chosen currency; opens a searchable list of every
 * currency. Arrow keys move, Enter picks, Escape closes.
 */
export default function CurrencyPicker({
  currencies,
  value,
  onChange,
  size = "md",
}: {
  currencies: readonly FiatCurrency[];
  value: string;
  onChange: (code: string) => void;
  /** "sm" matches the 36px icon buttons in the coin header. */
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const options = useMemo(() => matchCurrencies(currencies, query), [currencies, query]);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(0);
    }
  };

  const pick = (currency: FiatCurrency | undefined) => {
    if (!currency) return;
    onChange(currency.code);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(options[active]);
    }
  };

  const activeId = options[active] ? `${listId}-${options[active].code}` : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpenState}>
      <Popover.Trigger
        aria-label={`Currency: ${value.toUpperCase()}. Change currency`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-lg border bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50",
          size === "sm" ? "h-9 px-2.5" : "h-11 px-3"
        )}
      >
        {value.toUpperCase()}
        <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-2 shadow-lg animate-in fade-in"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-label="Search currencies"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              placeholder="Search, e.g. euro or JPY"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-9 w-full rounded-lg border bg-white pl-8 pr-2 text-sm outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200"
            />
          </div>

          <ul id={listId} role="listbox" aria-label="Currencies" className="mt-2 max-h-64 overflow-y-auto">
            {options.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted-foreground">No currency matches “{query.trim()}”.</li>
            )}
            {options.map((currency, i) => (
              <li
                key={currency.code}
                id={`${listId}-${currency.code}`}
                role="option"
                aria-selected={currency.code === value}
                onClick={() => pick(currency)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  i === active ? "bg-gray-100" : "bg-white"
                )}
              >
                <span className="w-10 shrink-0 font-semibold text-gray-900">{currency.code.toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-gray-600">{currency.name}</span>
                {currency.code === value ? (
                  <Check className="h-4 w-4 shrink-0 text-gray-900" aria-hidden="true" />
                ) : (
                  <span className="shrink-0 text-xs text-gray-400">{currency.unit}</span>
                )}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
