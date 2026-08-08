
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


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
    <div className=" ">

      {/* Coin Information */}
      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">{data.name}</CardTitle>
        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
         ${data.market_data.current_price.usd?.toLocaleString()}
        </CardDescription>
      </CardHeader>
      </Card>

    {/* Market Cap */}
      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">Market Cap</CardTitle>
        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
         ${data.market_data.market_cap.usd?.toLocaleString()}
        </CardDescription>
      </CardHeader>
      </Card>

      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">Total Supply: </CardTitle>
        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
           {data.market_data.total_supply?.toLocaleString()}
        </CardDescription>
      </CardHeader>
      </Card>

      <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-gray-700 font-semibold">Circulating Supply:</CardTitle>
        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
           {data.market_data.circulating_supply?.toLocaleString()}
        </CardDescription>
      </CardHeader>
      </Card>

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
              className="text-blue-500 hover:underline"
            >
              {url}
            </a>
          </p>
        ))}
    </div>
  );
}