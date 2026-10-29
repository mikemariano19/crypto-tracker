"use client";

import {
  COINS_PER_PAGE,
  MAX_COIN_PAGES,
  coinsPageKey,
  useCoinsByIds,
  useCryptoPrices,
} from "@/hooks/useCryptoPrices";
import { useFavorites } from "@/hooks/useFavorites";
import Pagination from "@/components/Pagination";
import FavoriteButton from "@/components/FavoriteButton";
import CoinSearch from "@/components/coin/CoinSearch";
import { Star } from "lucide-react";
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
  const isFavoritesView = searchParams.get("view") === "favorites";

  const { favorites } = useFavorites();
  const allCoins = useCryptoPrices(page);
  const favoriteCoins = useCoinsByIds(isFavoritesView ? favorites : []);

  const rows = isFavoritesView
    // Drop un-starred coins right away instead of waiting for the refetch.
    ? favoriteCoins.coins.filter((coin) => favorites.includes(coin.id))
    : allCoins.prices;
  const isLoading = isFavoritesView ? favoriteCoins.isLoading : allCoins.isLoading;
  const isError = isFavoritesView ? favoriteCoins.isError : allCoins.isError;

  // keepPreviousData shows the old page while the new one loads.
  const isChangingPage = !isFavoritesView && allCoins.isLoading && allCoins.prices.length > 0;
  const firstRank = (page - 1) * COINS_PER_PAGE + 1;

  const setView = (view: "all" | "favorites") => {
    router.push(view === "favorites" ? "/?view=favorites" : "/", { scroll: false });
  };

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

  // Shown instead of the table when there are no rows to display.
  let emptyState: React.ReactNode = null;

  if (isFavoritesView && favorites.length === 0) {
    emptyState = (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-white px-4 py-12 text-center">
        <Star className="h-8 w-8 text-amber-300" />
        <p className="text-sm font-semibold text-gray-900">No favorites yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Tap the ☆ next to any coin, in the table or in search, to keep it here.
          Favorites are saved in this browser.
        </p>
        <button
          type="button"
          onClick={() => setView("all")}
          className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
        >
          Browse all coins
        </button>
      </div>
    );
  } else if (rows.length === 0 && isError) {
    emptyState = (
      <div className="rounded-xl border bg-white py-12 text-center">
        <p className="text-sm font-medium text-red-500">Failed to load prices</p>
        <p className="mt-1 text-xs text-muted-foreground">Retrying automatically...</p>
      </div>
    );
  } else if (rows.length === 0) {
    emptyState = (
      <div className="rounded-xl border bg-white py-12 text-center text-sm text-muted-foreground">
        {isLoading ? "Loading market data..." : "No coins to show."}
      </div>
    );
  }

  const tabClass = (selected: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      selected ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="w-full pt-2">

      {/* Header + toolbar (scroll target when changing pages, clear of the sticky navbar) */}
      <div ref={topRef} className="mb-3 flex scroll-mt-20 flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold">
            Cryptocurrency Market
          </h2>

          <p className="text-xs text-muted-foreground">
            {isFavoritesView
              ? "Your favorite coins, saved in this browser"
              : `Top cryptocurrencies by market capitalization · Showing #${firstRank}–${firstRank + COINS_PER_PAGE - 1}`}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Table view" className="inline-flex w-fit rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              role="tab"
              aria-selected={!isFavoritesView}
              onClick={() => setView("all")}
              className={tabClass(!isFavoritesView)}
            >
              All Coins
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isFavoritesView}
              onClick={() => setView("favorites")}
              className={tabClass(isFavoritesView)}
            >
              <Star
                className={`h-3.5 w-3.5 ${
                  isFavoritesView ? "fill-amber-400 text-amber-400" : ""
                }`}
              />
              Favorites
              {favorites.length > 0 && (
                <span className="rounded-full bg-gray-200 px-1.5 text-[10px] text-gray-700">
                  {favorites.length}
                </span>
              )}
            </button>
          </div>

          <CoinSearch className="w-full sm:w-72" />
        </div>
      </div>

      {emptyState ?? (<>
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
                  w-16 min-w-16 max-w-16
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
                  sticky left-16 z-30
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

            {rows.map((coin, index) => {

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
                      w-16 min-w-16 max-w-16
                      px-1
                      py-3
                      bg-white
                      group-hover:bg-gray-50
                      text-center
                      text-[11px]
                      text-gray-400
                    "
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <FavoriteButton coinId={coin.id} coinName={coin.name} />
                      <span>
                        {isFavoritesView ? coin.market_cap_rank ?? "—" : firstRank + index}
                      </span>
                    </div>
                  </TableCell>


                  {/* =========================
                      COIN
                  ========================== */}
                  <TableCell
                    className="
                      sticky left-16 z-20
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
      </>)}

      {!isFavoritesView && (
        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={MAX_COIN_PAGES}
            onPageChange={goToPage}
            onPrefetch={prefetchPage}
          />
        </div>
      )}

    </div>
  );
}