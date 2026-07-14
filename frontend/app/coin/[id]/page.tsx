type Props = {
  params: Promise<{
    id: string;
    total_supply: string;
  }>;
};

export default async function CoinPage({ params }: Props) {
  const { id, total_supply } = await params;

  return (
    <div className="max-w-6xl mx-auto py-10">
      <h1>{id}</h1>
      <h2>{total_supply}</h2>
    </div>
  );
}