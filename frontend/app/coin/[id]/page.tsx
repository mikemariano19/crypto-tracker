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
    </div>
  );
}