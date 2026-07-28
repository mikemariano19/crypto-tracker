import CoinPrice from "@/components/CoinPrice";
import CryptoTable from "@/components/CryptoTable";
import MarketCap from "@/components/MarketCap";
import Trending from "@/components/Trending";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CoinPage({ params }: Props) {
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
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <h1>{data.name}</h1>

      <p>Price: ${data.market_data.current_price.usd?.toLocaleString()}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CoinPrice />
        <MarketCap />
      </div>
      <CryptoTable />

      <p>Total Supply: {data.market_data.total_supply?.toLocaleString()}</p>
      <p>Market Cap Rank: {data.market_cap_rank}</p>

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