import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Coins,
  Gauge,
  Layers,
  Percent,
} from "lucide-react";
import Image from "next/image";

import { formatNumber } from "@/lib/formatNumber";
import { formatPercentage, formatDateWithAge } from "@/lib/formatCryptoStats";
import { formatCryptoPrice } from "@/lib/formatCryptoPrices";
import ReadMore from "@/components/ReadMore";
import CryptoChart from "@/components/coin/CryptoChart";
import UpdatedAgo from "@/components/UpdatedAgo";
import InfoTip from "@/components/InfoTip";
import FavoriteButton from "@/components/FavoriteButton";
import { METRIC_INFO, type MetricInfo } from "@/lib/metricInfo";
import type { CoinProfile } from "@/types/crypto";

function usd(value: number | null, format: (value: number) => string = formatNumber) {
  return value === null ? "—" : `$${format(value)}`;
}

function StatCard({
  icon,
  info,
  value,
}: {
  icon: React.ReactNode;
  info: MetricInfo;
  value: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent>
        <InfoTip {...info} className="mb-2 gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs sm:text-sm">{info.title}</span>
        </InfoTip>
        <p className="truncate text-base font-bold sm:text-lg">{value}</p>
      </CardContent>
    </Card>
  );
}

function ExtremeCard({
  info,
  price,
  change,
  date,
  tone,
}: {
  info: MetricInfo;
  price: number | null;
  change: number | null;
  date: string | null;
  tone: "high" | "low";
}) {
  const isHigh = tone === "high";

  return (
    <Card className="border-0 shadow-sm">
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <InfoTip {...info} className="text-sm text-muted-foreground">
              {info.title}
            </InfoTip>
            <p className="mt-1 text-xl font-bold">
              {usd(price, formatCryptoPrice)}
            </p>
          </div>

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isHigh ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"
            }`}
          >
            {isHigh ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className={`font-semibold ${isHigh ? "text-red-500" : "text-green-500"}`}>
            {formatPercentage(change)}
          </span>
          <span className="text-right text-muted-foreground">
            {formatDateWithAge(date)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function CoinProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-36 animate-pulse rounded-xl bg-white shadow-sm" />
      <div className="h-115 animate-pulse rounded-xl bg-white shadow-sm" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}

function signedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${formatPercentage(value)}`;
}

function changeTone(value: number | null) {
  if (value === null || value === 0) return "text-gray-500";
  return value > 0 ? "text-green-600" : "text-red-500";
}

/**
 * Where the current price sits within today's range. CoinGecko updates the
 * 24h high/low less often than the price, so widen the range to include it.
 */
function DayRange({ price, low, high }: { price: number; low: number; high: number }) {
  const rangeLow = Math.min(low, price);
  const rangeHigh = Math.max(high, price);
  const position = rangeHigh > rangeLow ? ((price - rangeLow) / (rangeHigh - rangeLow)) * 100 : 50;

  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-linear-to-r from-red-200 via-gray-200 to-green-200">
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-900 shadow"
          style={{ left: `${position}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs">
        <span className="text-muted-foreground">
          24h Low <span className="font-semibold text-foreground">${formatCryptoPrice(rangeLow)}</span>
        </span>
        <span className="text-muted-foreground">
          24h High <span className="font-semibold text-foreground">${formatCryptoPrice(rangeHigh)}</span>
        </span>
      </div>
    </div>
  );
}

function SupplyCard({ coin }: { coin: CoinProfile }) {
  // Progress toward the hard cap, or toward total supply if there is none.
  const cap = coin.max_supply ?? coin.total_supply;
  const progress =
    coin.circulating_supply !== null && cap ? Math.min(100, (coin.circulating_supply / cap) * 100) : null;

  return (
    <Card className="col-span-2 border-0 shadow-sm">
      <CardContent>
        <div className="mb-2 flex items-center justify-between gap-2 text-muted-foreground">
          <InfoTip {...METRIC_INFO.circulatingSupply} className="gap-2">
            <Coins className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Circulating Supply</span>
          </InfoTip>
          {progress !== null && (
            <span className="text-xs font-semibold text-foreground">{progress.toFixed(1)}%</span>
          )}
        </div>

        <p className="truncate text-base font-bold sm:text-lg">
          {formatNumber(coin.circulating_supply)}{" "}
          <span className="text-xs font-semibold uppercase text-muted-foreground">{coin.symbol}</span>
        </p>

        {progress !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gray-900" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PERFORMANCE: { label: string; key: keyof CoinProfile }[] = [
  { label: "1h", key: "price_change_percentage_1h" },
  { label: "24h", key: "price_change_percentage_24h" },
  { label: "7d", key: "price_change_percentage_7d" },
  { label: "30d", key: "price_change_percentage_30d" },
  { label: "1y", key: "price_change_percentage_1y" },
];

export default function CoinProfileView({ coin }: { coin: CoinProfile }) {
  const change = coin.price_change_percentage_24h ?? 0;
  const isPositive = change >= 0;
  const volumeToMarketCap =
    coin.total_volume !== null && coin.market_cap ? coin.total_volume / coin.market_cap : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {coin.image && (
                <Image
                  src={coin.image}
                  alt={coin.name}
                  width={44}
                  height={44}
                  className="shrink-0 rounded-full"
                  priority
                />
              )}
  
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold sm:text-2xl">{coin.name}</h1>
  
                  <span className="rounded bg-muted px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                    {coin.symbol}
                  </span>
  
                  {coin.market_cap_rank && (
                    <span className="rounded bg-muted px-2 py-1 text-xs font-semibold">
                      #{coin.market_cap_rank}
                    </span>
                  )}
                </div>
  
                <p className="text-sm text-muted-foreground">
                  {coin.name} price and market statistics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <UpdatedAgo timestamp={coin.last_updated} />
              <FavoriteButton coinId={coin.id} coinName={coin.name} size="md" />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Current Price</p>
              <div className="text-3xl font-bold tracking-tight sm:text-4xl">
                {usd(coin.price, formatCryptoPrice)}
              </div>
            </div>

            {coin.price_change_percentage_24h !== null && (
              <div
                className={`inline-flex items-center gap-1 self-start rounded-full px-3 py-1.5 text-sm font-semibold sm:self-end ${
                  isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                }`}
              >
                {isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(change).toFixed(2)}%
                {coin.price_change_24h !== null && (
                  <span className="font-medium">
                    ({coin.price_change_24h >= 0 ? "+" : "-"}${formatCryptoPrice(Math.abs(coin.price_change_24h))})
                  </span>
                )}
                <span className="font-normal opacity-70">24h</span>
              </div>
            )}
          </div>

          {coin.price !== null && coin.low_24h !== null && coin.high_24h !== null && (
            <DayRange price={coin.price} low={coin.low_24h} high={coin.high_24h} />
          )}

          {/* Performance across timeframes */}
          <div className="grid grid-cols-5 divide-x rounded-lg bg-muted/50 py-2">
            {PERFORMANCE.map(({ label, key }) => {
              const value = coin[key] as number | null;

              return (
                <div key={label} className="px-1 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className={`truncate text-xs font-semibold sm:text-sm ${changeTone(value)}`}>
                    {signedPercent(value)}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Chart ends at the same live price shown above */}
      <CryptoChart
        coinId={coin.id}
        livePrice={coin.price}
        liveUpdatedAt={coin.last_updated}
      />

      {/* Market overview */}
      <div>
        <h2 className="mb-3 text-lg font-bold">Market Overview</h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<CircleDollarSign className="h-4 w-4" />}
            info={METRIC_INFO.marketCap}
            value={usd(coin.market_cap)}
          />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            info={METRIC_INFO.fdv}
            value={usd(coin.fully_diluted_valuation)}
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            info={METRIC_INFO.volume}
            value={usd(coin.total_volume)}
          />
          <StatCard
            icon={<Percent className="h-4 w-4" />}
            info={METRIC_INFO.volumeToMarketCap}
            value={volumeToMarketCap === null ? "—" : volumeToMarketCap.toFixed(4)}
          />
          <SupplyCard coin={coin} />
          <StatCard
            icon={<Coins className="h-4 w-4" />}
            info={METRIC_INFO.totalSupply}
            value={formatNumber(coin.total_supply)}
          />
          <StatCard
            icon={<Gauge className="h-4 w-4" />}
            info={METRIC_INFO.maxSupply}
            value={coin.max_supply ? formatNumber(coin.max_supply) : "∞"}
          />
        </div>
      </div>

      {/* Price history */}
      <div>
        <h2 className="mb-3 text-lg font-bold">Price History</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ExtremeCard
            info={METRIC_INFO.ath}
            price={coin.ath}
            change={coin.ath_change_percentage}
            date={coin.ath_date}
            tone="high"
          />
          <ExtremeCard
            info={METRIC_INFO.atl}
            price={coin.atl}
            change={coin.atl_change_percentage}
            date={coin.atl_date}
            tone="low"
          />
        </div>
      </div>

      {/* Additional information */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y">
            <div className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Genesis Date</span>
              </div>
              <span className="text-right text-sm font-semibold">
                {coin.genesis_date || "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="flex items-center gap-3">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Hashing Algorithm</span>
              </div>
              <span className="text-right text-sm font-semibold">
                {coin.hashing_algorithm || "N/A"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      {coin.description && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>About {coin.name}</CardTitle>
            <CardDescription>{coin.symbol.toUpperCase()} overview</CardDescription>
          </CardHeader>

          <CardContent>
            <ReadMore text={coin.description} maxLength={500} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
