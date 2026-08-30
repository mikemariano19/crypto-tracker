export function formatNumber(value: number | null | undefined): string {
  const format = (num: number, suffix: string) =>
    `${parseFloat(num.toFixed(2))}${suffix}`;

   if (value === null || value === undefined) {
    return "N/A";
  }

  if (value >= 1_000_000_000_000) {
    return format(value / 1_000_000_000_000, "T");
  }

  if (value >= 1_000_000_000) {
    return format(value / 1_000_000_000, "B");
  }

  if (value >= 1_000_000) {
    return format(value / 1_000_000, "M");
  }

  if (value >= 1_000) {
    return format(value / 1_000, "K");
  }

  return value.toLocaleString();
}