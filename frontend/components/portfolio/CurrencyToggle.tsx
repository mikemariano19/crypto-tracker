"use client";

import type { Currency } from "@/lib/wallet/schema";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Currency; label: string }[] = [
  { value: "usd", label: "USD" },
  { value: "php", label: "PHP" },
];

/**
 * USD | PHP. Both prices arrive in one request, so switching is instant.
 */
export default function CurrencyToggle({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (currency: Currency) => void;
}) {
  return (
    <div role="group" aria-label="Currency" className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
            value === option.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
