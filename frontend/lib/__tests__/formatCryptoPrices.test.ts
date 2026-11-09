import { describe, expect, it } from "vitest";
import { formatCryptoPrice } from "@/lib/formatCryptoPrices";

describe("formatCryptoPrice", () => {
  it("formats each price band", () => {
    expect(formatCryptoPrice(104_523.456)).toBe("104,523.46");
    expect(formatCryptoPrice(1)).toBe("1.00");
    expect(formatCryptoPrice(0.5)).toBe("0.50");
    expect(formatCryptoPrice(0.123456)).toBe("0.12346");
    expect(formatCryptoPrice(0.00001234)).toBe("0.00001234");
    expect(formatCryptoPrice(0.000000001)).toBe("0.00000");
  });

  it("handles missing and zero values", () => {
    expect(formatCryptoPrice(null)).toBe("—");
    expect(formatCryptoPrice(undefined)).toBe("—");
    expect(formatCryptoPrice(NaN)).toBe("—");
    expect(formatCryptoPrice(0)).toBe("0");
  });

  it("matches the toLocaleString output it replaced", () => {
    const bands: [number, number, number][] = [
      [1, 2, 2],
      [0.01, 2, 5],
      [0, 5, 8],
    ];

    for (const value of [65_000.1, 3.14159, 1.005, 0.999999, 0.0123, 0.00999, 0.0000042]) {
      const [, min, max] = bands.find(([from]) => value >= from)!;
      expect(formatCryptoPrice(value)).toBe(
        value.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max })
      );
    }
  });
});
