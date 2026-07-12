type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CoinPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="max-w-6xl mx-auto py-10">
      <h1>{id}</h1>
    </div>
  );
}