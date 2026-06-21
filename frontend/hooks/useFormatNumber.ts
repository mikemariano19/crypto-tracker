import { useCallback } from "react";

type FormatOptions = {
  decimals?: number;
  currency?: string; // optional symbol like "$"
};

export function useFormatNumber() {
  const format = useCallback((value?: number, options?: FormatOptions) => {
    if (value === null || value === undefined || isNaN(value)) return "-";

    const { decimals = 2, currency = "" } = options || {};

    const abs = Math.abs(value);

    let formatted = value;
    let suffix = "";

    if (abs >= 1e12) {
      formatted = value / 1e12;
      suffix = "T";
    } else if (abs >= 1e9) {
      formatted = value / 1e9;
      suffix = "B";
    } else if (abs >= 1e6) {
      formatted = value / 1e6;
      suffix = "M";
    } else if (abs >= 1e3) {
      formatted = value / 1e3;
      suffix = "K";
    }

    return `${currency}${formatted.toFixed(decimals)}${suffix}`;
  }, []);

  return { format };
}