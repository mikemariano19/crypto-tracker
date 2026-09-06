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
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // $0.01 - $0.999...
  if (value >= 0.01) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    });
  }

  // Very small crypto prices
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 8,
  });
}