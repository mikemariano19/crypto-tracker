/**
 * The exact whole-dollar amount: $2,850,123,456,789.
 */
export function formatFullUsd(value: number | null | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;

  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Large dollar amounts in short form: $2.85T, $96.12B, $4.20M, $1.50K.
 */
export function formatCompactUsd(value: number | null | undefined): string {
  if (!value) return "$0";

  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  return `$${value.toLocaleString()}`;
}
