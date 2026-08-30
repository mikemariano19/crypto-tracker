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


export default function CryptoTable() {
  const { prices, isLoading, isError } = useCryptoPrices();
  const router = useRouter();

  if (isLoading && prices.length === 0) {
    return <div className="text-center py-10">Loading prices...</div>;
  }

  if (isError && prices.length === 0) {
    return (
      <div className="text-center py-10 text-red-500">
        Failed to load prices. Retrying...
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="overflow-x-auto rounded-lg border border-gray-200 mx-0 md:mx-5 lg:mx-2">
        <Table className="min-w-40 w-full border-collapse">
          
          <TableHeader className="bg-white">
            <TableRow>
              {/* ✅ Sticky # column */}
              <TableHead className="sticky left-0  w-8 text-center">
                #
              </TableHead>
              {/* ✅ Sticky Coin column — offset by width of # column (~40px) */}
              <TableHead className="sticky left-8.5 min-w-40 z-10 ">
                Coin
              </TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">1h %</TableHead>
              <TableHead className="text-right">24h %</TableHead>
              <TableHead className="text-right">7d %</TableHead>
              <TableHead className="text-right whitespace-nowrap">24h Volume</TableHead>
              <TableHead className="text-right whitespace-nowrap pr-3">Market Cap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
               {prices.map((coin, index) => (
                <TableRow className="md:pr-2 bg-white hover:bg-gray-100 transition-colors hover:cursor-pointer" 
                key={coin.id}
                onClick={() => router.push(`/coin/${coin.id}`)}
                >
                  {/* ✅ Sticky # cell */}
                  <TableCell className="sticky left-0 p-2 text-center text-gray-500 text-sm ">
                    {index + 1}
                  </TableCell>

                  {/* ✅ Sticky Coin cell — no flex! use inline-flex on inner div */}
                  <TableCell className="sticky left-8.5 min-w-10 max-w-10 ">
                    <div className="flex items-center gap-2">
                      <Image
                        alt={coin.name}
                        width={24}
                        height={24}
                        src={coin.image}
                      />
                      <div className="flex flex-col leading-tight ">
                        <span className="font-semibold text-sm whitespace-pre-wrap">
                          {coin.name}
                        </span>
                        <span className="text-xs text-gray-400 uppercase">
                          {coin.symbol}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap">
                    ${formatCryptoPrice(coin.current_price)}
                  </TableCell>

                  <TableCell
                    className="text-right font-medium whitespace-nowrap"
                    style={{
                      color:
                        (coin.price_change_percentage_1h_in_currency ?? 0) > 0
                          ? "#16a34a"
                          : "#dc2626",
                    }}
                  >
                    {coin.price_change_percentage_1h_in_currency?.toFixed(2)}%
                  </TableCell>

                  <TableCell
                    className="text-right font-medium whitespace-nowrap"
                    style={{
                      color:
                        (coin.price_change_percentage_24h ?? 0) > 0
                          ? "#16a34a"
                          : "#dc2626",
                    }}
                  >
                    {coin.price_change_percentage_24h?.toFixed(2)}%
                  </TableCell>

                  <TableCell
                    className="text-right font-medium whitespace-nowrap"
                    style={{
                      color:
                        (coin.price_change_percentage_7d_in_currency ?? 0) > 0
                          ? "#16a34a"
                          : "#dc2626",
                    }}
                  >
                    {coin.price_change_percentage_7d_in_currency?.toFixed(2)}%
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap">
                    ${coin.total_volume.toLocaleString()}
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap pr-3">
                    ${coin.market_cap.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}