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
    <div>
      <h1>{data.name}</h1>

      <p>Price: ${data.market_data.current_price.usd}</p>

      <p>Market Cap: ${data.market_data.market_cap.usd}</p>

      <p>Total Supply: {data.market_data.total_supply}</p>

      <p>Circulating Supply: {data.market_data.circulating_supply}</p>
      <p>Block Time: {data.block_time_in_minutes} minutes</p>
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