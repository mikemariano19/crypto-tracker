import { useTradingVolume } from "@/hooks/useTradingVolume";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


export default function TradingVolume() {
  const {
    volume_24h,
  } = useTradingVolume();


  return (
    <Card className="w-full max-w-md my-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-gray-600 font-semibold">Trading Volume</CardTitle>
        </div>

        <CardDescription className="text-2xl md:text-xl font-bold text-foreground">
          {volume_24h?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "Loading..."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}