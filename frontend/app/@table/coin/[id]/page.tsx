
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown } from "lucide-react";
import Image from "next/image";

import { formatNumber } from "@/lib/formatNumber";
import {formatPercentage,formatDateWithAge} from "@/lib/formatCryptoStats";


type Props = {
  params: Promise<{
    id: string;
    name: string;
    image: {
      thumb: string;
      small: string;
      large: string;
    }; 
  }>;
};



export default async function marketCap({ params }: Props) {
  const { id } = await params;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/coins/${id}`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
  throw new Error(`API returned ${res.status}`);
}

 const json = await res.json();
 const data = json.data;
 const changePercentage = data.market_data.price_change_percentage_24h ?? 0;
 const isPositive = changePercentage >= 0;



  return (
    <div className="flex flex-col gap-4 p-2 max-w-5xl sm:mx-2 md:mx-4 lg:mx-auto">
      <h1 className="text-xl font-bold">{data.name} Statistics</h1>
      
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      
    {/* Market Cap */}
      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold flex items-center gap-2">
          {data.image && (
            <Image
              alt={data.name}
              width={24}
              height={24}
              src={data.image.small}
            />
          )}
          {data.name} 
            <div className="flex leading-tight ">
                <span className="text-xs text-gray-400 uppercase content-center">
                  {data.symbol} Price 
                </span>
                <span className="text-md  rounded bg-gray-100 ml-2 p-0.5 border-gray-300 font-bold inline">
                  #{data.market_cap_rank}
                </span>
            </div>
        </CardTitle>
        
        <CardDescription className="flex justify-between text-2xl md:text-xl font-bold text-foreground">
         ${data.market_data.current_price.usd?.toLocaleString()}
          <div
            className={`flex lg:items-center text-lg font-semibold ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          >
            {isPositive ? (
              <ArrowUp className="h-5 w-5" />
            ) : (
              <ArrowDown className="h-5 w-5" />
            )}

            {Math.abs(changePercentage).toFixed(2)}%(24h)
          </div>
        </CardDescription>
      </CardHeader>
      </Card>

      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">24 Hour Trading Volume: </CardTitle>
        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
           ${formatNumber(data.market_data.total_volume.usd)}
        </CardDescription>
      </CardHeader>
      </Card>

      
     </div>

      <Table className="text-md border-collapse w-full grid grid-cols-1 md:grid-cols-2 gap-y-0 gap-x-4">

        <TableBody className="border-y">
          <TableRow className="flex justify-between py-4">
            <TableCell className="font-semibold text-gray-700">
              Market Cap:
            </TableCell>
            <TableCell className="font-bold">
                <p> ${formatNumber(data.market_data.market_cap.usd)}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b md:border-t">
          <TableRow className="flex justify-between py-4">
            <TableCell className="font-semibold text-gray-700">
              Circulating Supply:
            </TableCell>
            <TableCell className="font-bold">
                <p>{formatNumber(data.market_data.circulating_supply)}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b">
          <TableRow className="flex justify-between py-4">
            <TableCell className="font-semibold text-gray-700">
              24 Hour Trading Volume:
            </TableCell>
            <TableCell className="font-bold">
                <p> ${formatNumber(data.market_data.total_volume.usd)}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b">
          <TableRow className="flex justify-between py-4">
            <TableCell className="font-semibold text-gray-700">
              Max Supply:
            </TableCell>
            <TableCell className="font-bold">
                <p> {formatNumber(data.market_data.max_supply)}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b">
          <TableRow className="flex justify-between py-2">
            <TableCell className="font-semibold text-gray-700 content-center">
              All Time High:
            </TableCell>
            <TableCell className="font-bold gap-2">
                <div className="flex justify-end gap-2">
                  <p> ${data.market_data.ath.usd.toLocaleString()}</p>
                  <p className="text-red-500 text-[14px] flex justify-end items-center"> {formatPercentage(data.market_data.ath_change_percentage.usd)}</p>
                </div>
                <div className="text-gray-500 text-sm font-light flex justify-end">
                  <p> {formatDateWithAge(data.market_data.ath_date.usd)}</p>
                </div>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b">
          <TableRow className="flex justify-between py-2">
            <TableCell className="font-semibold text-gray-700 content-center">
              All Time Low:
            </TableCell>
            <TableCell className="font-bold gap-2">
                <div className="flex justify-end gap-2">
                  <p> ${data.market_data.atl.usd.toLocaleString()}</p>
                  <p className="text-green-500 text-[14px] flex justify-end items-center"> {formatPercentage(data.market_data.atl_change_percentage.usd)}</p>
                </div>
                <div className="text-gray-500 text-sm font-light flex justify-end">
                  <p> {formatDateWithAge(data.market_data.atl_date.usd)}</p>
                </div>
            </TableCell>  
          </TableRow>
        </TableBody>

       
      </Table>

      <p>Market Cap Rank: {data.market_cap_rank}</p>
      <p>Total Supply: {formatNumber(data.market_data.total_supply)}</p>

      <p>Circulating Supply: {formatNumber(data.market_data.circulating_supply)}</p>
      <p>Hashing Algorithm: {data.hashing_algorithm}</p>
      <p>Category: {data.categories}</p>
      <p>Genesis Date: {data.genesis_date}</p>
      <p>Description: {data.description.en}</p>
      <p>Homepage: {data.links.homepage}</p>
      <p>Whitepaper: {data.whitepaper}</p>
       {data.links.blockchain_site
        .filter((url: string) => url !== "")
        .map((url: string, index: number) => (
          <p key={index}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all"
            >
              {url}
            </a>
          </p>
        ))}
    </div>
  );
}