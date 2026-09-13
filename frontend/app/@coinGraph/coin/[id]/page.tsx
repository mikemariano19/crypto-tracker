import CryptoChart from "@/components/CryptoChart";


export default async function CoinGraph({ params }: { params: { id: string } }) {
  const { id } = await params;

  // Your existing coin profile fetch...

  return (
    <div className="space-y-6">
      {/* Coin header and price */}

      <CryptoChart coinId={id} />

      Market cap, supplies, description, etc.
    </div>
  );
}