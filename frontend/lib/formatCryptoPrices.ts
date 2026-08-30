export function formatCryptoPrice(value: number | null | undefined): string {
  if (value == null || isNaN(value)) {
    return "—";
  }

  // Very small prices: show up to 5 decimal places
  if (value < 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    });
  }

  // $1 and above: show 2 decimal places
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}