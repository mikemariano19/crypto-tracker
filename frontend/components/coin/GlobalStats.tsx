"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Gauge, PieChart } from "lucide-react";

import useGlobalStats from "@/hooks/useGlobalStats";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useFearGreed } from "@/hooks/useFearGreed";
import { formatCryptoPrice } from "@/lib/formatCryptoPrices";
import { METRIC_INFO } from "@/lib/metricInfo";
import InfoTip from "@/components/InfoTip";

const ITEM = "flex shrink-0 items-center gap-2 px-3 first:pl-0 sm:justify-center sm:px-2 sm:first:pl-2";
const LABEL = "text-[10px] uppercase tracking-wide text-muted-foreground";
const VALUE = "whitespace-nowrap text-xs font-semibold text-foreground sm:text-sm";

function Placeholder() {
  return <span className="mt-0.5 block h-3.5 w-16 animate-pulse rounded bg-muted" />;
}

function Change({ value }: { value: number | null | undefined }) {
  if (value == null) return null;

  const isUp = value >= 0;

  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold ${
        isUp ? "text-green-600" : "text-red-500"
      }`}
    >
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

// alternative.me's bands: 0-24 extreme fear ... 75-100 extreme greed.
function sentimentColor(value: number) {
  if (value < 25) return { text: "text-red-600", bar: "bg-red-500" };
  if (value < 45) return { text: "text-orange-500", bar: "bg-orange-400" };
  if (value <= 55) return { text: "text-amber-500", bar: "bg-amber-400" };
  if (value < 75) return { text: "text-lime-600", bar: "bg-lime-500" };
  return { text: "text-green-600", bar: "bg-green-500" };
}

function CoinTicker({
  id,
  symbol,
  coin,
}: {
  id: string;
  symbol: string;
  coin?: { image: string; current_price: number; price_change_percentage_24h: number | null };
}) {
  return (
    <Link
      href={`/coin/${id}`}
      className={`${ITEM} rounded-md transition-colors hover:bg-muted/60`}
    >
      {coin?.image ? (
        <Image
          src={coin.image}
          alt={symbol}
          width={28}
          height={28}
          className="hidden h-7 w-7 rounded-full sm:block"
        />
      ) : (
        <span className="hidden h-7 w-7 rounded-full bg-muted sm:block" />
      )}

      <div>
        <p className={LABEL}>{symbol}</p>
        {coin ? (
          <p className={`${VALUE} flex items-center gap-1.5`}>
            ${formatCryptoPrice(coin.current_price)}
            <Change value={coin.price_change_percentage_24h} />
          </p>
        ) : (
          <Placeholder />
        )}
      </div>
    </Link>
  );
}

/**
 * Market strip under the page top: BTC and ETH prices, BTC dominance and
 * the Fear & Greed Index. Scrolls sideways on narrow screens.
 */
export default function GlobalStats() {
  const { prices } = useCryptoPrices();
  const { btc_dominance } = useGlobalStats();
  const { fearGreed } = useFearGreed();

  const btc = prices.find((coin) => coin.id === "bitcoin");
  const eth = prices.find((coin) => coin.id === "ethereum");

  const sentiment = fearGreed ? sentimentColor(fearGreed.value) : null;
  const sentimentChange =
    fearGreed?.previous_value != null ? fearGreed.value - fearGreed.previous_value : null;

  return (
    <div className="w-full border-y bg-white">
      <div className="mx-auto max-w-5xl px-3 py-2 sm:px-4">
        <div className="flex divide-x overflow-x-auto [scrollbar-width:none] sm:grid sm:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          <CoinTicker id="bitcoin" symbol="BTC" coin={btc} />
          <CoinTicker id="ethereum" symbol="ETH" coin={eth} />

          {/* BTC dominance */}
          <div className={ITEM}>
            <div className="hidden h-7 w-7 items-center justify-center rounded-md bg-orange-50 sm:flex">
              <PieChart className="h-3.5 w-3.5 text-orange-500" />
            </div>

            <div>
              <InfoTip {...METRIC_INFO.btcDominance} className={`${LABEL} gap-1`}>
                BTC Dominance
              </InfoTip>
              {btc_dominance != null ? (
                <p className={VALUE}>{btc_dominance.toFixed(2)}%</p>
              ) : (
                <Placeholder />
              )}
            </div>
          </div>

          {/* Fear & Greed */}
          <div className={ITEM}>
            <div className="hidden h-7 w-7 items-center justify-center rounded-md bg-muted sm:flex">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div>
              <InfoTip {...METRIC_INFO.fearGreed} className={`${LABEL} gap-1`}>
                Fear &amp; Greed
              </InfoTip>
              {fearGreed && sentiment ? (
                <>
                  <p className={`${VALUE} flex items-center gap-1.5`}>
                    <span className={sentiment.text}>
                      {fearGreed.value} · {fearGreed.classification ?? "—"}
                    </span>
                    {sentimentChange !== null && sentimentChange !== 0 && (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {sentimentChange > 0 ? "+" : ""}
                        {sentimentChange}
                      </span>
                    )}
                  </p>
                  <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${sentiment.bar}`}
                      style={{ width: `${fearGreed.value}%` }}
                    />
                  </div>
                </>
              ) : (
                <Placeholder />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
