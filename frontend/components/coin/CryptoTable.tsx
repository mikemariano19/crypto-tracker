"use client";

import {
  COINS_PER_PAGE,
  MAX_COIN_PAGES,
  coinsPageKey,
  useCryptoPrices,
} from "@/hooks/useCryptoPrices";
import Pagination from "@/components/Pagination";
import { fetchApi } from "@/lib/api";
import Image from "next/image";
import { useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter, useSearchParams } from "next/navigation";

import { formatCryptoPrice } from "@/lib/formatCryptoPrices";
import { formatCompactUsd } from "@/lib/formatCompactUsd";

function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (Object.is(value, -0)) {
    return "0.00%";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function PercentageCell({
  value,
}: {
  value: number | null | undefined;
}) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <span
      className={
        isPositive
          ? "font-medium text-green-600"
          : isNegative
          ? "font-medium text-red-500"
          : "font-medium text-gray-500"
      }
    >
      {formatPercentage(value)}
    </span>
  );
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= MAX_COIN_PAGES ? page : 1;
}

export default function CryptoTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The page lives in the URL so refresh, sharing and Back all work.
  const page = parsePage(searchParams.get("page"));

  const { prices, isLoading, isError } = useCryptoPrices(page);
  // keepPreviousData shows the old page while the new one loads.
  const isChangingPage = isLoading && prices.length > 0;
  const firstRank = (page - 1) * COINS_PER_PAGE + 1;

  const topRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<number>());

  const goToPage = (target: number) => {
    router.push(target === 1 ? "/" : `/?page=${target}`, { scroll: false });
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Warm the browser and API caches on hover so the click feels instant.
  const prefetchPage = useCallback((target: number) => {
    if (target === page || prefetched.current.has(target)) return;
    prefetched.current.add(target);
    fetchApi(coinsPageKey(target)).catch(() => prefetched.current.delete(target));
  }, [page]);

  if (isLoading && prices.length === 0) {
    return (
      <div className="w-full">
        <div className="rounded-xl border bg-white py-12 text-center text-sm text-muted-foreground">
          Loading market data...
        </div>
      </div>
    );
  }

  if (isError && prices.length === 0) {
    return (
      <div className="w-full">
        <div className="rounded-xl border bg-white py-12 text-center">
          <p className="text-sm font-medium text-red-500">
            Failed to load prices
          </p>

          <p className="text-xs text-muted-foreground mt-1">
            Retrying automatically...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pt-2">

      {/* Header (scroll target when changing pages, clear of the sticky navbar) */}
      <div ref={topRef} className="mb-3 scroll-mt-20">
        <h2 className="text-lg font-bold">
          Cryptocurrency Market
        </h2>

        <p className="text-xs text-muted-foreground">
          Top cryptocurrencies by market capitalization · Showing #{firstRank}–
          {firstRank + COINS_PER_PAGE - 1}
        </p>
      </div>

      {/* Table wrapper */}
      <div
        aria-busy={isChangingPage}
        className={`overflow-x-auto rounded-xl border bg-white shadow-sm transition-opacity ${
          isChangingPage ? "pointer-events-none opacity-50" : ""
        }`}
      >

        <Table className="min-w-190 border-collapse">

          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-b">

              {/* =========================
                  RANK
              ========================== */}
              <TableHead
                className="
                  sticky left-0 z-30
                  w-9 min-w-9 max-w-9
                  px-1
                  bg-gray-50
                  text-center
                  text-[11px]
                  font-semibold
                  text-gray-500
                "
              >
                #
              </TableHead>

              {/* =========================
                  COIN
              ========================== */}
              <TableHead
                className="
                  sticky left-9 z-30
                  w-31.25
                  min-w-31.25
                  max-w-31.25
                  sm:w-40
                  sm:min-w-40
                  sm:max-w-40
                  px-2
                  bg-gray-50
                  text-[11px]
                  font-semibold
                  text-gray-500
                "
              >
                Coin
              </TableHead>

              {/* PRICE */}
              <TableHead className="text-right px-2 text-[11px] font-semibold text-gray-500">
                Price
              </TableHead>

              {/* 1H */}
              <TableHead className="text-right px-2 text-[11px] font-semibold text-gray-500">
                1h
              </TableHead>

              {/* 24H */}
              <TableHead className="text-right px-2 text-[11px] font-semibold text-gray-500">
                24h
              </TableHead>

              {/* 7D */}
              <TableHead className="text-right px-2 text-[11px] font-semibold text-gray-500">
                7d
              </TableHead>

              {/* VOLUME */}
              <TableHead className="text-right whitespace-nowrap px-2 text-[11px] font-semibold text-gray-500">
                24h Volume
              </TableHead>

              {/* MARKET CAP */}
              <TableHead className="text-right whitespace-nowrap px-3 text-[11px] font-semibold text-gray-500">
                Market Cap
              </TableHead>

            </TableRow>
          </TableHeader>


          <TableBody>

            {prices.map((coin, index) => {

              const change1h =
                coin.price_change_percentage_1h_in_currency;

              const change24h =
                coin.price_change_percentage_24h;

              const change7d =
                coin.price_change_percentage_7d_in_currency;

              return (
                <TableRow
                  key={coin.id}
                  onClick={() =>
                    router.push(`/coin/${coin.id}`)
                  }
                  className="
                    group
                    cursor-pointer
                    border-b
                    last:border-0
                    hover:bg-gray-50
                    transition-colors
                  "
                >

                  {/* =========================
                      RANK
                  ========================== */}
                  <TableCell
                    className="
                      sticky left-0 z-20
                      w-9 min-w-9 max-w-9
                      px-1
                      py-3
                      bg-white
                      group-hover:bg-gray-50
                      text-center
                      text-[11px]
                      text-gray-400
                    "
                  >
                    {firstRank + index}
                  </TableCell>


                  {/* =========================
                      COIN
                  ========================== */}
                  <TableCell
                    className="
                      sticky left-9 z-20
                      w-31.25
                      min-w-31.25
                      max-w-31.25
                      sm:w-40
                      sm:min-w-40
                      sm:max-w-40
                      px-2
                      py-3
                      bg-white
                      group-hover:bg-gray-50
                    "
                  >

                    <div className="flex items-center gap-2 min-w-0">

                      {/* Coin icon */}
                      <Image
                        alt={coin.name}
                        width={28}
                        height={28}
                        src={coin.image}
                        className="rounded-full shrink-0"
                      />

                      {/* Coin name */}
                      <div className="flex flex-col min-w-0 leading-tight">

                        <span
                          className="
                            font-semibold
                            text-xs
                            truncate
                            max-w-20.5
                            sm:max-w-27.5
                          "
                          title={coin.name}
                        >
                          {coin.name}
                        </span>

                        <span className="text-[10px] uppercase text-gray-400">
                          {coin.symbol}
                        </span>

                      </div>

                    </div>

                  </TableCell>


                  {/* =========================
                      PRICE
                  ========================== */}
                  <TableCell
                    className="
                      text-right
                      whitespace-nowrap
                      px-2
                      text-xs
                      font-semibold
                    "
                  >
                    ${formatCryptoPrice(coin.current_price)}
                  </TableCell>


                  {/* =========================
                      1H
                  ========================== */}
                  <TableCell
                    className="
                      text-right
                      whitespace-nowrap
                      px-2
                      text-xs
                    "
                  >
                    <PercentageCell value={change1h} />
                  </TableCell>


                  {/* =========================
                      24H
                  ========================== */}
                  <TableCell
                    className="
                      text-right
                      whitespace-nowrap
                      px-2
                      text-xs
                    "
                  >
                    <PercentageCell value={change24h} />
                  </TableCell>


                  {/* =========================
                      7D
                  ========================== */}
                  <TableCell
                    className="
                      text-right
                      whitespace-nowrap
                      px-2
                      text-xs
                    "
                  >
                    <PercentageCell value={change7d} />
                  </TableCell>


                  {/* =========================
                      VOLUME
                  ========================== */}
                  <TableCell
                    className="
                      text-right
                      whitespace-nowrap
                      px-2
                      text-xs
                      text-gray-700
                    "
                  >
                    {formatCompactUsd(
                      coin.total_volume
                    )}
                  </TableCell>


                  {/* =========================
                      MARKET CAP
                  ========================== */}
                  <TableCell
                    className="
                      text-right
                      whitespace-nowrap
                      px-3
                      text-xs
                      font-medium
                      text-gray-700
                    "
                  >
                    {formatCompactUsd(
                      coin.market_cap
                    )}
                  </TableCell>

                </TableRow>
              );
            })}

          </TableBody>
        </Table>
      </div>

      {/* Mobile hint */}
      <p className="mt-2 text-center text-[10px] text-muted-foreground md:hidden">
        Swipe left or right to view market data
      </p>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={MAX_COIN_PAGES}
          onPageChange={goToPage}
          onPrefetch={prefetchPage}
        />
      </div>

    </div>
  );
}