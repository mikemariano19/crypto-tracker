import { formatSignedPct } from "@/lib/formatNews";
import { zoneMiddle, zonesByPrice } from "@/lib/insight";
import { formatFiatPrice, type Money } from "@/lib/money";
import type { PriceZone } from "@/types/insight";

const STRENGTH_TEXT: Record<PriceZone["strength"], string> = {
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
};

/**
 * The levels as a real table: the accessible alternative to the zones drawn on
 * the chart, which a screen reader can't see.
 */
export default function KeyLevelsTable({ zones, money }: { zones: PriceZone[]; money: Money }) {
  const hasResistance = zones.some((zone) => zone.type === "resistance");
  const hasSupport = zones.some((zone) => zone.type === "support");

  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Key levels</h3>

      {zones.length > 0 && (
        <table className="w-full text-xs">
          <caption className="sr-only">Support and resistance levels, highest price first</caption>
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500">
              <th scope="col" className="pb-1 font-medium">Level</th>
              <th scope="col" className="pb-1 text-right font-medium">Price</th>
              <th scope="col" className="pb-1 text-right font-medium">Away</th>
              <th scope="col" className="pb-1 text-right font-medium">Strength</th>
            </tr>
          </thead>
          <tbody>
            {zonesByPrice(zones).map((zone) => (
              <tr key={zone.id} className="border-t">
                <th
                  scope="row"
                  className={`py-1.5 text-left font-bold ${zone.type === "resistance" ? "text-red-500" : "text-green-600"}`}
                >
                  {zone.id}
                  <span className="sr-only"> {zone.type}</span>
                </th>
                <td className="py-1.5 text-right font-semibold text-gray-900">{formatFiatPrice(zoneMiddle(zone), money)}</td>
                <td className="py-1.5 text-right text-gray-500">{formatSignedPct(zone.distancePct, 1)}</td>
                <td className="py-1.5 text-right text-gray-500">{zone.testing ? "Testing" : STRENGTH_TEXT[zone.strength]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Price at a new high or low has no swing points on that side yet. */}
      {!hasResistance && <p className="mt-1.5 text-xs text-muted-foreground">No resistance level found in this period.</p>}
      {!hasSupport && <p className="mt-1.5 text-xs text-muted-foreground">No support level found in this period.</p>}
    </div>
  );
}
