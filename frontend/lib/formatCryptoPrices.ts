import { formatDecimal } from "@/lib/formatDecimal";

// Runs for every price on the page, so it avoids Intl: see formatDecimal.
export function formatCryptoPrice(
  value: number | null | undefined
): string {
  if (value == null || isNaN(value)) {
    return "—";
  }

  if (value === 0) {
    return "0";
  }

  // $1 or higher
  if (value >= 1) {
    return formatDecimal(value, 2, 2);
  }

  // $0.01 - $0.999...
  if (value >= 0.01) {
    return formatDecimal(value, 2, 5);
  }

  // Very small crypto prices
  return formatDecimal(value, 5, 8);
}
