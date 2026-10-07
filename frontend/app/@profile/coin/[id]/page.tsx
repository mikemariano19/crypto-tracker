import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowDown, ArrowUp, CalendarDays, CircleDollarSign, Coins, Gauge, BarChart3 } from "lucide-react";
import Image from "next/image";

import { formatNumber } from "@/lib/formatNumber";
import {
  formatPercentage,
  formatDateWithAge,
} from "@/lib/formatCryptoStats";
import { formatCryptoPrice } from "@/lib/formatCryptoPrices";
import ReadMore from "@/components/ReadMore";
import CryptoChart from "@/components/coin/CryptoChart";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CoinProfile({ params }: Props) {
  const { id } = await params;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/coin/${id}`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }

  const json = await res.json();
  const data = json.data;

  const changePercentage =
    data.market_data.price_change_percentage_24h ?? 0;

  const isPositive = changePercentage >= 0;

  const price = data.market_data.current_price.usd;
  const marketCap = data.market_data.market_cap.usd;
  const volume = data.market_data.total_volume.usd;
  const circulatingSupply = data.market_data.circulating_supply;
  const maxSupply = data.market_data.max_supply;

  return (
    <main className="w-full max-w-5xl mx-auto px-3 sm:px-4 pb-10 space-y-4">

      {/* =========================================================
          COIN HEADER
      ========================================================= */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 sm:p-6">

          <div className="flex flex-col gap-5">

            {/* Coin identity */}
            <div className="flex items-center justify-between gap-3">

              <div className="flex items-center gap-3 min-w-0">

                {data.image?.small && (
                  <Image
                    src={data.image.small}
                    alt={data.name}
                    width={44}
                    height={44}
                    className="rounded-full shrink-0"
                  />
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold truncate">
                      {data.name}
                    </h1>

                    <span className="text-xs font-semibold uppercase text-muted-foreground bg-muted px-2 py-1 rounded">
                      {data.symbol}
                    </span>

                    {data.market_cap_rank && (
                      <span className="text-xs font-semibold bg-muted px-2 py-1 rounded">
                        #{data.market_cap_rank}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {data.name} price and market statistics
                  </p>
                </div>
              </div>

            </div>

            {/* Price */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">

              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Current Price
                </p>

                <div className="text-3xl sm:text-4xl font-bold tracking-tight">
                  ${formatCryptoPrice(price)}
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1 self-start sm:self-end px-3 py-1.5 rounded-full text-sm font-semibold ${
                  isPositive
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {isPositive ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}

                {Math.abs(changePercentage).toFixed(2)}%
                <span className="font-normal opacity-70">
                  24h
                </span>
              </div>

            </div>

          </div>
        </CardContent>
      </Card>


      {/* =========================================================
          CHART
      ========================================================= */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">
            Price Chart
          </CardTitle>

          <CardDescription>
            {data.name} market performance
          </CardDescription>
        </CardHeader>

        <CardContent className="p-2 sm:p-4">
          <CryptoChart coinId={id} />
        </CardContent>
      </Card>


      {/* =========================================================
          MARKET OVERVIEW
      ========================================================= */}
      <div>
        <h2 className="text-lg font-bold mb-3">
          Market Overview
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Market Cap */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">

              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CircleDollarSign className="h-4 w-4" />

                <span className="text-xs sm:text-sm">
                  Market Cap
                </span>
              </div>

              <p className="text-base sm:text-lg font-bold break-all">
                ${formatNumber(marketCap)}
              </p>

            </CardContent>
          </Card>


          {/* Volume */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">

              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <BarChart3 className="h-4 w-4" />

                <span className="text-xs sm:text-sm">
                  24h Volume
                </span>
              </div>

              <p className="text-base sm:text-lg font-bold break-all">
                ${formatNumber(volume)}
              </p>

            </CardContent>
          </Card>


          {/* Circulating Supply */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">

              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Coins className="h-4 w-4" />

                <span className="text-xs sm:text-sm">
                  Circulating
                </span>
              </div>

              <p className="text-base sm:text-lg font-bold break-all">
                {formatNumber(circulatingSupply)}
              </p>

            </CardContent>
          </Card>


          {/* Max Supply */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">

              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Gauge className="h-4 w-4" />

                <span className="text-xs sm:text-sm">
                  Max Supply
                </span>
              </div>

              <p className="text-base sm:text-lg font-bold break-all">
                {maxSupply
                  ? formatNumber(maxSupply)
                  : "∞"}
              </p>

            </CardContent>
          </Card>

        </div>
      </div>


      {/* =========================================================
          PRICE HISTORY
      ========================================================= */}
      <div>
        <h2 className="text-lg font-bold mb-3">
          Price History
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* ATH */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">

              <div className="flex items-center justify-between mb-4">

                <div>
                  <p className="text-sm text-muted-foreground">
                    All-Time High
                  </p>

                  <p className="text-xl font-bold mt-1">
                    ${data.market_data.ath.usd.toLocaleString()}
                  </p>
                </div>

                <div className="h-10 w-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                  <ArrowUp className="h-5 w-5" />
                </div>

              </div>

              <div className="flex items-center justify-between text-sm">

                <span className="text-red-500 font-semibold">
                  {formatPercentage(
                    data.market_data.ath_change_percentage.usd
                  )}
                </span>

                <span className="text-muted-foreground">
                  {formatDateWithAge(
                    data.market_data.ath_date.usd
                  )}
                </span>

              </div>

            </CardContent>
          </Card>


          {/* ATL */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">

              <div className="flex items-center justify-between mb-4">

                <div>
                  <p className="text-sm text-muted-foreground">
                    All-Time Low
                  </p>

                  <p className="text-xl font-bold mt-1">
                    ${data.market_data.atl.usd.toLocaleString()}
                  </p>
                </div>

                <div className="h-10 w-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center">
                  <ArrowDown className="h-5 w-5" />
                </div>

              </div>

              <div className="flex items-center justify-between text-sm">

                <span className="text-green-500 font-semibold">
                  {formatPercentage(
                    data.market_data.atl_change_percentage.usd
                  )}
                </span>

                <span className="text-muted-foreground">
                  {formatDateWithAge(
                    data.market_data.atl_date.usd
                  )}
                </span>

              </div>

            </CardContent>
          </Card>

        </div>
      </div>


      {/* =========================================================
          ADDITIONAL INFORMATION
      ========================================================= */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>
            Additional Information
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">

          <div className="divide-y">

            {/* Genesis */}
            <div className="flex items-center justify-between gap-4 px-4 py-4">

              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />

                <span className="text-sm text-muted-foreground">
                  Genesis Date
                </span>
              </div>

              <span className="text-sm font-semibold text-right">
                {data.genesis_date || "N/A"}
              </span>

            </div>


            {/* Algorithm */}
            <div className="flex items-center justify-between gap-4 px-4 py-4">

              <div className="flex items-center gap-3">
                <Gauge className="h-4 w-4 text-muted-foreground" />

                <span className="text-sm text-muted-foreground">
                  Hashing Algorithm
                </span>
              </div>

              <span className="text-sm font-semibold text-right">
                {data.hashing_algorithm || "N/A"}
              </span>

            </div>

          </div>

        </CardContent>
      </Card>


      {/* =========================================================
          ABOUT
      ========================================================= */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>
            About {data.name}
          </CardTitle>

          <CardDescription>
            {data.symbol.toUpperCase()} overview
          </CardDescription>
        </CardHeader>

        <CardContent>
          <ReadMore
            text={data.description.en}
            maxLength={500}
          />
        </CardContent>
      </Card>

    </main>
  );
}
