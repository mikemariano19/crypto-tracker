import type Decimal from "decimal.js";
import { formatSignedMoney, formatSignedPercent } from "@/lib/portfolio";
import type { Currency } from "@/lib/wallet/schema";
import { cn } from "@/lib/utils";

/**
 * "▲ +₱12,345.67 (+1.01%)": arrow and sign carry the direction, colour only
 * backs them up.
 */
export default function ChangeText({
  value,
  pct,
  currency,
  className,
}: {
  value?: Decimal | null;
  pct: Decimal | number | null;
  currency?: Currency;
  className?: string;
}) {
  if (pct === null) return <span className={cn("text-muted-foreground", className)}>—</span>;

  // Direction from the rounded text, so "−0.001%" doesn't show as a fall.
  const text = formatSignedPercent(pct);
  const down = text.startsWith("−");
  const flat = text === "+0.00%";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums font-medium",
        flat ? "text-gray-600" : down ? "text-red-700" : "text-green-700",
        className
      )}
    >
      {!flat && (
        <span aria-hidden="true" className="text-[0.7em]">
          {down ? "▼" : "▲"}
        </span>
      )}
      {value != null && currency ? (
        <>
          {formatSignedMoney(value, currency)}
          <span className="font-normal">({formatSignedPercent(pct)})</span>
        </>
      ) : (
        formatSignedPercent(pct)
      )}
    </span>
  );
}
