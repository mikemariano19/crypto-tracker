"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, RefreshCw } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCryptoPrice } from "@/lib/formatCryptoPrices";
import { formatPercentage } from "@/lib/formatCryptoStats";
import type { RankedCoin } from "@/types/crypto";
import type { MetricInfo } from "@/lib/metricInfo";
import InfoTip from "@/components/InfoTip";

const PREVIEW_ROWS = 3;

export function CoinAvatar({ coin, size = 28 }: { coin: RankedCoin; size?: number }) {
  return coin.image ? (
    <Image
      src={coin.image}
      alt={coin.name}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="shrink-0 rounded-full bg-muted"
      style={{ width: size, height: size }}
    />
  );
}

export function ChangePill({ value }: { value: number | null }) {
  const change = value ?? 0;
  const isPositive = change >= 0;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold ${
        isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
      }`}
    >
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {formatPercentage(Math.abs(change))}
    </span>
  );
}

function RowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-13 items-center justify-between gap-3">
      {children}
    </div>
  );
}

function PlaceholderRow({ pulse }: { pulse: boolean }) {
  const tone = pulse ? "animate-pulse bg-muted" : "bg-muted/60";

  return (
    <RowShell>
      <div className="flex items-center gap-3">
        <div className={`h-7 w-7 rounded-full ${tone}`} />
        <div className="space-y-2">
          <div className={`h-3.5 w-24 rounded ${tone}`} />
          <div className={`h-2.5 w-12 rounded ${tone}`} />
        </div>
      </div>
      <div className={`h-6 w-16 rounded-full ${tone}`} />
    </RowShell>
  );
}

type CoinListCardProps = {
  // Card title plus the explanation shown when hovering it.
  info: MetricInfo;
  subtitle: string;
  icon: React.ReactNode;
  iconClassName: string;
  href: string;
  moreLabel: string;
  coins: RankedCoin[];
  isValidating: boolean;
  variant: "price" | "change";
};

export default function CoinListCard({
  info,
  subtitle,
  icon,
  iconClassName,
  href,
  moreLabel,
  coins,
  isValidating,
  variant,
}: CoinListCardProps) {
  const preview = coins.slice(0, PREVIEW_ROWS);
  const hasCoins = preview.length > 0;

  return (
    <Card className="h-full border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}
          >
            {icon}
          </div>

          <div className="min-w-0">
            <CardTitle className="text-base font-bold">
              <InfoTip {...info}>{info.title}</InfoTip>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>

          {/* Cached data is on screen while fresh data loads */}
          {hasCoins && isValidating && (
            <RefreshCw
              className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground"
              aria-label="Updating"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="divide-y">
          {preview.map((coin) => (
            <Link
              key={coin.id}
              href={`/coin/${coin.id}`}
              className="-mx-2 block rounded-md px-2 transition-colors hover:bg-muted/50"
            >
              <RowShell>
                <div className="flex min-w-0 items-center gap-3">
                  <CoinAvatar coin={coin} />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{coin.name}</p>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      {coin.symbol}
                    </p>
                  </div>
                </div>

                {variant === "price" ? (
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <p className="text-xs font-medium">
                      ${formatCryptoPrice(coin.price)}
                    </p>
                    <ChangePill value={coin.price_change_percentage_24h} />
                  </div>
                ) : (
                  <ChangePill value={coin.price_change_percentage_24h} />
                )}
              </RowShell>
            </Link>
          ))}

          {/* Always render the same number of rows so the cards line up */}
          {Array.from({ length: PREVIEW_ROWS - preview.length }).map((_, index) => (
            <PlaceholderRow key={`placeholder-${index}`} pulse={!hasCoins} />
          ))}
        </div>
      </CardContent>

      <CardFooter className="p-0">
        <Link
          href={href}
          className="flex w-full items-center justify-center gap-1 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {moreLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
