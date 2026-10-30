import { CoinProfileSkeleton } from "@/components/coin/CoinProfileView";

export default function Loading() {
  return (
    <div className="mt-4 w-full pb-10">
      <CoinProfileSkeleton />
    </div>
  );
}
