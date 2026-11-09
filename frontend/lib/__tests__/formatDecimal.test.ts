import { describe, expect, it } from "vitest";
import { formatDecimal } from "@/lib/formatDecimal";

const intl = (value: number, min: number, max: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

// The digit settings the app uses: prices (2/2, 2/5, 5/8) and whole dollars.
const SETTINGS: [number, number][] = [[2, 2], [2, 5], [5, 8], [0, 0]];

describe("formatDecimal", () => {
  it("groups thousands and trims trailing zeros", () => {
    expect(formatDecimal(1234567.891, 2, 2)).toBe("1,234,567.89");
    expect(formatDecimal(0.5, 2, 5)).toBe("0.50");
    expect(formatDecimal(0.123456, 2, 5)).toBe("0.12346");
    expect(formatDecimal(2850123456789.4, 0, 0)).toBe("2,850,123,456,789");
    expect(formatDecimal(999.999, 2, 2)).toBe("1,000.00");
    expect(formatDecimal(100, 0, 0)).toBe("100");
  });

  it("matches toLocaleString on edge cases", () => {
    const values = [0, 1, 999, 1000, 1.005, 2.675, 0.015, 0.0000125, 123456.785, 0.99999999, 1e15 + 0.5];
    for (const value of values) {
      for (const [min, max] of SETTINGS) {
        expect(formatDecimal(value, min, max), `${value} ${min}/${max}`).toBe(intl(value, min, max));
      }
    }
  });

  it("matches toLocaleString on random prices of every size", () => {
    let seed = 42;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    for (let i = 0; i < 5000; i++) {
      // Spread across 1e-9 .. 1e13, the range coin prices and market caps live in.
      const value = Math.pow(10, random() * 22 - 9) * (1 + random());
      for (const [min, max] of SETTINGS) {
        expect(formatDecimal(value, min, max), `${value} ${min}/${max}`).toBe(intl(value, min, max));
      }
    }
  });
});
