/**
 * The same text as value.toLocaleString("en-US", { minimumFractionDigits,
 * maximumFractionDigits }), without Intl. The first Intl formatter a page
 * creates loads ICU locale data, which cost ~120 ms on a throttled phone
 * during the home page's load. Prices are always en-US (see lib/money.ts),
 * so plain digit work is enough.
 *
 * Like Intl, it rounds the shortest decimal form of the number ("1.005", not
 * the 1.00499… that toFixed sees), half away from zero.
 */
export function formatDecimal(value: number, minDigits: number, maxDigits: number): string {
  if (!Number.isFinite(value)) return String(value);

  // String() gives the shortest round-trip digits, possibly as "1.5e-7".
  const [mantissa, exponent] = String(Math.abs(value)).split("e");
  const dot = mantissa.indexOf(".");
  let digits = mantissa.replace(".", "");
  // How many of `digits` sit before the decimal point.
  let point = (dot === -1 ? mantissa.length : dot) + Number(exponent ?? 0);

  if (point < 0) {
    digits = "0".repeat(-point) + digits;
    point = 0;
  }

  const keep = point + maxDigits;
  if (digits.length > keep) {
    const roundUp = digits[keep] >= "5";
    digits = digits.slice(0, keep);

    if (roundUp) {
      const chars = digits.split("");
      let i = chars.length - 1;
      while (i >= 0 && chars[i] === "9") chars[i--] = "0";
      if (i >= 0) {
        chars[i] = String(Number(chars[i]) + 1);
      } else {
        // 9.99 → 10.0: the carry adds a digit in front.
        chars.unshift("1");
        point++;
      }
      digits = chars.join("");
    }
  }

  const whole = digits.slice(0, point).padEnd(point, "0").replace(/^0+(?=\d)/, "") || "0";
  let fraction = digits.slice(point).padEnd(minDigits, "0");
  while (fraction.length > minDigits && fraction.endsWith("0")) fraction = fraction.slice(0, -1);

  let grouped = "";
  for (let i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 === 0) grouped += ",";
    grouped += whole[i];
  }

  return (value < 0 ? "-" : "") + grouped + (fraction ? `.${fraction}` : "");
}
