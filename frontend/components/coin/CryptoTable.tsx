"use client";

import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";

import { formatCryptoPrice } from "@/lib/formatCryptoPrices";

function formatCompactNumber(value: number) {
  if (!value || value === 0) return "$0";

  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  return `$${value.toLocaleString()}`;
}

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

export default function CryptoTable() {
  const { prices, isLoading, isError } = useCryptoPrices();
  const router = useRouter();

  if (isLoading && prices.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto px-2 md:px-4">
        <div className="rounded-xl border bg-white py-12 text-center text-sm text-muted-foreground">
          Loading market data...
        </div>
      </div>
    );
  }

  if (isError && prices.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto px-2 md:px-4">
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
    <div className="w-full max-w-5xl mx-auto px-2 md:px-4">

      {/* Header */}
      <div className="mb-3">
        <h2 className="text-lg font-bold">
          Cryptocurrency Market
        </h2>

        <p className="text-xs text-muted-foreground">
          Top cryptocurrencies by market capitalization
        </p>
      </div>

      {/* Table wrapper */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">

        <Table className="min-w-[760px] border-collapse">

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
                  w-[125px]
                  min-w-[125px]
                  max-w-[125px]
                  sm:w-[160px]
                  sm:min-w-[160px]
                  sm:max-w-[160px]
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
                    {index + 1}
                  </TableCell>


                  {/* =========================
                      COIN
                  ========================== */}
                  <TableCell
                    className="
                      sticky left-9 z-20
                      w-[125px]
                      min-w-[125px]
                      max-w-[125px]
                      sm:w-[160px]
                      sm:min-w-[160px]
                      sm:max-w-[160px]
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
                            max-w-[82px]
                            sm:max-w-[110px]
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
                    {formatCompactNumber(
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
                    {formatCompactNumber(
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

    </div>
  );
}