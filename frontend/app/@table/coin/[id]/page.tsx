
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";


type Props = {
  params: Promise<{
    id: string;
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

  return (
    <div className="flex flex-col gap-4 p-2 max-w-5xl mx-auto sm:mx-2 md:mx-4 lg:mx-2">
      <h1 className="text-xl font-bold">{data.name} Statistics</h1>
      
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      
    {/* Market Cap */}
      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">{data.symbol.toUpperCase()} Price</CardTitle>
        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
         ${data.market_data.current_price.usd?.toLocaleString()}
        </CardDescription>
      </CardHeader>
      </Card>

      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">24 Hour Trading Volume: </CardTitle>
        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
           {data.market_data.total_volume?.toLocaleString()}
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
                <p> ${data.market_data.market_cap.usd?.toLocaleString()}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b md:border-t">
          <TableRow className="flex justify-between py-4">
            <TableCell className="font-semibold text-gray-700">
              Circulating Supply:
            </TableCell>
            <TableCell className="font-bold">
                <p> ${data.market_data.circulating_supply?.toLocaleString()}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b">
          <TableRow className="flex justify-between py-4">
            <TableCell className="font-semibold text-gray-700">
              24 Hour Trading Volume:
            </TableCell>
            <TableCell className="font-bold">
                <p> ${data.market_data.total_volume?.toLocaleString()}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

        <TableBody className="border-b">
          <TableRow className="flex justify-between py-4">
            <TableCell className="font-semibold text-gray-700">
              Max Supply:
            </TableCell>
            <TableCell className="font-bold">
                <p> ${data.market_data.max_supply?.toLocaleString()}</p>
            </TableCell>  
          </TableRow>
        </TableBody>

      </Table>

      <p>Market Cap Rank: {data.market_cap_rank}</p>
      <p>Total Supply: {data.market_data.total_supply?.toLocaleString()}</p>

      <p>Circulating Supply: {data.market_data.circulating_supply?.toLocaleString()}</p>
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