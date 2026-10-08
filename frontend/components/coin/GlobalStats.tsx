"use client";

import useGlobalStats from "@/hooks/useGlobalStats";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { Coins, DollarSign, PieChart } from "lucide-react";

export default function GlobalStats() {
  const {
    coinsCount,
    marketCap,
    btc_dominance,
    eth_dominance,
  } = useGlobalStats();

  const { format } = useFormatNumber();

  return (
    <div className="w-full border-y bg-white">

      <div
        className="
          mx-auto
          max-w-5xl
          px-3
          py-2.5
        "
      >

        <div
          className="
            grid
            grid-cols-3
            divide-x
            rounded-lg
          "
        >

          {/* =========================
              COINS
          ========================== */}
          <div className="flex items-center justify-center gap-2 px-2">

            <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-md bg-muted">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div className="text-center sm:text-left">

              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Coins
              </p>

              <p className="text-xs sm:text-sm font-semibold text-foreground">
                {coinsCount?.toLocaleString() ?? "0"}
              </p>

            </div>

          </div>


          {/* =========================
              MARKET CAP
          ========================== */}
          <div className="flex items-center justify-center gap-2 px-2">

            <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-md bg-muted">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div className="text-center sm:text-left min-w-0">

              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Market Cap
              </p>

              <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {format(marketCap, {
                  currency: "$",
                  decimals: 2,
                })}
              </p>

            </div>

          </div>


          {/* =========================
              DOMINANCE
          ========================== */}
          <div className="flex items-center justify-center gap-2 px-2">

            <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-md bg-muted">
              <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div className="text-center sm:text-left">

              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Dominance
              </p>

              <p className="text-[10px] sm:text-sm font-semibold whitespace-nowrap">
                <span className="text-orange-500">
                  BTC {btc_dominance?.toFixed(2)}%
                </span>

                <span className="text-muted-foreground mx-1">
                  /
                </span>

                <span className="text-blue-500">
                  ETH {eth_dominance?.toFixed(2)}%
                </span>
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}