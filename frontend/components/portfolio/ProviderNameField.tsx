"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import SourceMark from "@/components/news/SourceMark";
import { PROVIDER_KIND_LABELS, searchProviders, type WalletProvider } from "@/lib/wallet/providers";
import { cn } from "@/lib/utils";

/**
 * The wallet name input, with exchange/wallet suggestions and logos. Any
 * name can still be typed; picking a suggestion fills in the name and its
 * logo. Follows the ARIA combobox pattern (arrows, Enter, Escape).
 */
export default function ProviderNameField({
  id,
  value,
  onChange,
  providers,
  provider,
  onPick,
  onOpenChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  providers: readonly WalletProvider[];
  /** The provider the current name refers to, shown as the leading logo. */
  provider: WalletProvider | null;
  onPick: (provider: WalletProvider) => void;
  /** Lets a surrounding dialog ignore Escape while the list is open. */
  onOpenChange?: (open: boolean) => void;
  invalid: boolean;
  describedBy: string;
}) {
  const [open, setOpenState] = useState(false);
  const [active, setActive] = useState(0);
  const listId = `${id}-list`;

  // Once the name is exactly a provider, stop suggesting until it changes.
  const options = provider && value.trim().toLowerCase() === provider.name.toLowerCase() ? [] : searchProviders(providers, value);
  const showList = open && options.length > 0;
  const current = options[Math.min(active, options.length - 1)];

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  const pick = (choice: WalletProvider | undefined) => {
    if (!choice) return;
    setOpen(false);
    onPick(choice);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        // With the list open, Enter picks; otherwise it submits the form.
        if (showList) {
          event.preventDefault();
          pick(current);
        }
        break;
      case "Escape":
        if (open) setOpen(false);
        break;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2" aria-hidden="true">
          {provider ? (
            <SourceMark name={provider.name} iconUrl={provider.image} className="h-5 w-5 text-[10px]" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && current ? `${listId}-${current.id}` : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Search exchanges and wallets, or type any name"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-lg border bg-white pl-10 pr-3 text-sm outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 aria-invalid:border-red-400"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Exchanges and wallets"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg"
        >
          {!value.trim() && (
            <li role="presentation" className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Popular
            </li>
          )}
          {options.map((option, i) => (
            <li
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={option === current}
              // mousedown, not click: picking must happen before the input blurs.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm", option === current ? "bg-gray-100" : "bg-white")}
            >
              <SourceMark name={option.name} iconUrl={option.image} className="h-5 w-5 text-[10px]" />
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{option.name}</span>
              <span className="text-xs text-gray-500">{PROVIDER_KIND_LABELS[option.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
