"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flame, RefreshCw, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChangePill, CoinAvatar } from "@/components/coin/CoinListCard";
import { useTopGainers } from "@/hooks/useTopGainers";
import { useTrendingCoins } from "@/hooks/useTrending";
import { formatCryptoPrice } from "@/lib/formatCryptoPrices";
import { formatNumber } from "@/lib/formatNumber";
import type { RankedCoin } from "@/types/crypto";

const SKELETON_ROWS = 10;

// Pinned columns need fixed widths (the coin column starts where # ends)
// and solid backgrounds so scrolled cells pass underneath them.
const RANK_CELL = "sticky left-0 w-9 min-w-9 max-w-9 px-1 text-center";
const COIN_CELL = "sticky left-9 w-36 min-w-36 max-w-36 px-2 sm:w-52 sm:min-w-52 sm:max-w-52";
const BODY_STICKY = "z-20 bg-white group-hover:bg-gray-50";

type CoinRankingProps = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconClassName: string;
  coins: RankedCoin[];
  isLoading: boolean;
  isValidating: boolean;
  isError: boolean;
};

function CoinRanking({
  title,
  subtitle,
  icon,
  iconClassName,
  coins,
  isLoading,
  isValidating,
  isError,
}: CoinRankingProps) {
  const router = useRouter();
  const hasCoins = coins.length > 0;

  const headClass = "text-[11px] font-semibold text-gray-500";

  return (
    <div className="flex flex-col gap-4 py-4">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to market
      </Link>

      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconClassName}`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        {hasCoins && isValidating && (
          <RefreshCw
            className="ml-auto h-4 w-4 animate-spin text-muted-foreground"
            aria-label="Updating"
          />
        )}
      </div>

      {/* Same pattern as the main market table: on narrow screens the table
          scrolls sideways while # and Coin stay pinned on the left. */}
      <Card className="border-0 py-0 shadow-sm">
        <Table className="min-w-150 border-collapse">
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className={`${RANK_CELL} z-30 bg-gray-50 ${headClass}`}>#</TableHead>
              <TableHead className={`${COIN_CELL} z-30 bg-gray-50 ${headClass}`}>Coin</TableHead>
              <TableHead className={`px-3 text-right ${headClass}`}>Price</TableHead>
              <TableHead className={`px-3 text-right ${headClass}`}>24h</TableHead>
              <TableHead className={`whitespace-nowrap px-3 text-right ${headClass}`}>Market Cap</TableHead>
              <TableHead className={`whitespace-nowrap px-3 text-right ${headClass}`}>MC Rank</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {hasCoins &&
              coins.map((coin, index) => (
                <TableRow
                  key={coin.id}
                  onClick={() => router.push(`/coin/${coin.id}`)}
                  className="group cursor-pointer hover:bg-gray-50"
                >
                  <TableCell className={`${RANK_CELL} ${BODY_STICKY} py-3 text-[11px] text-gray-400`}>
                    {index + 1}
                  </TableCell>

                  <TableCell className={`${COIN_CELL} ${BODY_STICKY} py-3`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <CoinAvatar coin={coin} />
                      <div className="flex min-w-0 flex-col leading-tight">
                        <Link
                          href={`/coin/${coin.id}`}
                          title={coin.name}
                          className="truncate text-xs font-semibold hover:underline sm:text-sm"
                        >
                          {coin.name}
                        </Link>
                        <span className="text-[10px] uppercase text-gray-400">
                          {coin.symbol}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium">
                    ${formatCryptoPrice(coin.price)}
                  </TableCell>

                  <TableCell className="px-3 py-3 text-right">
                    <ChangePill value={coin.price_change_percentage_24h} />
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-3 py-3 text-right text-sm">
                    {coin.market_cap ? `$${formatNumber(coin.market_cap)}` : "—"}
                  </TableCell>

                  <TableCell className="px-3 py-3 text-right text-sm text-gray-500">
                    {coin.market_cap_rank ? `#${coin.market_cap_rank}` : "—"}
                  </TableCell>
                </TableRow>
              ))}

            {!hasCoins &&
              (isLoading || !isError) &&
              Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="group">
                  <TableCell className={`${RANK_CELL} ${BODY_STICKY} py-3`}>
                    <div className="mx-auto h-3 w-4 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className={`${COIN_CELL} ${BODY_STICKY} py-3`}>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
                      <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                    </div>
                  </TableCell>
                  {Array.from({ length: 4 }).map((_, cell) => (
                    <TableCell key={cell} className="px-3 py-3">
                      <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!hasCoins && !isLoading && isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Couldn&apos;t load data right now. Retrying automatically…
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function TopGainersRanking() {
  const { coins, isLoading, isValidating, isError } = useTopGainers();

  return (
    <CoinRanking
      title="Top 50 Gainers"
      subtitle="Biggest 24h price increases among the top 250 coins by market cap"
      icon={<TrendingUp className="h-5 w-5 text-green-600" />}
      iconClassName="bg-green-50"
      coins={coins}
      isLoading={isLoading}
      isValidating={isValidating}
      isError={isError}
    />
  );
}

export function TrendingRanking() {
  const { coins, isLoading, isValidating, isError } = useTrendingCoins();

  return (
    <CoinRanking
      title="Trending Coins"
      subtitle="Most searched coins on CoinGecko in the last 24 hours"
      icon={<Flame className="h-5 w-5 text-orange-500" />}
      iconClassName="bg-orange-50"
      coins={coins}
      isLoading={isLoading}
      isValidating={isValidating}
      isError={isError}
    />
  );
}
