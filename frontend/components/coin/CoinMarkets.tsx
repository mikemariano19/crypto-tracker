"use client";

import useSWR from "swr";
import { Store } from "lucide-react";
import ExternalLink from "@/components/ExternalLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiUrl, fetchApi } from "@/lib/api";
import { formatFiatCompact, formatFiatPrice } from "@/lib/money";
import type { CoinMarket } from "@/types/crypto";

/** DEX pairs name tokens by contract address; shorten those. */
function pairPart(text: string) {
  return text.length > 12 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
}

function Pair({ market }: { market: CoinMarket }) {
  return (
    <span className="font-medium text-gray-900" title={`${market.base}/${market.target}`}>
      {pairPart(market.base)}/{pairPart(market.target)}
    </span>
  );
}

function Exchange({ market }: { market: CoinMarket }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {market.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={market.logo} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 shrink-0 rounded-full" />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600" aria-hidden="true">
          {market.exchange.charAt(0)}
        </span>
      )}
      {market.trade_url ? (
        <ExternalLink href={market.trade_url} className="truncate font-semibold text-gray-900 hover:underline">
          {market.exchange}
        </ExternalLink>
      ) : (
        <span className="truncate font-semibold text-gray-900">{market.exchange}</span>
      )}
    </span>
  );
}

const spread = (value: number | null) => (value === null ? "—" : `${value.toFixed(2)}%`);

/**
 * Where the coin trades: the biggest exchange pairs by 24h volume.
 * Loaded separately from the profile, refreshed every 10 minutes.
 */
export default function CoinMarkets({ coinId, name }: { coinId: string; name: string }) {
  const wide = useMediaQuery("(min-width: 640px)", true);
  const { money } = useDisplayCurrency();
  const price = (value: number | null) => formatFiatPrice(value, money);
  const { data, error, isLoading } = useSWR<CoinMarket[]>(apiUrl(`/api/coin/${encodeURIComponent(coinId)}/markets`), fetchApi, {
    refreshInterval: 10 * 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const markets = data ?? [];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Where to trade {name}
        </CardTitle>
        <CardDescription>Top exchange pairs by 24h volume</CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading && markets.length === 0 ? (
          <div className="space-y-2" aria-label="Loading markets">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="block h-8 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {error ? "Exchange data couldn’t be loaded right now." : "No exchange listings found."}
          </p>
        ) : wide ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 text-left font-medium">Exchange</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Pair</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">24h volume</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {markets.map((market, i) => (
                  <tr key={`${market.exchange}-${market.base}-${market.target}-${i}`}>
                    <td className="max-w-48 py-2.5 pr-3"><Exchange market={market} /></td>
                    <td className="px-3 py-2.5"><Pair market={market} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{price(market.price)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatFiatCompact(market.volume, money)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">{spread(market.spread)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="divide-y">
            {markets.map((market, i) => (
              <li key={`${market.exchange}-${market.base}-${market.target}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Exchange market={market} />
                  <p className="mt-0.5 pl-7 text-xs text-muted-foreground"><Pair market={market} /></p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="text-gray-900">{price(market.price)}</p>
                  <p className="text-xs text-muted-foreground">Vol {formatFiatCompact(market.volume, money)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Listings come from CoinGecko. This isn’t a recommendation of any exchange.
        </p>
      </CardContent>
    </Card>
  );
}
