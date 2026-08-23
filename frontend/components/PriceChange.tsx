import { ArrowUp, ArrowDown } from "lucide-react";

type PriceChangeProps = {
  value: number | null | undefined;
};

export default function PriceChange({ value }: PriceChangeProps) {
  const percentage = value ?? 0;
  const isPositive = percentage >= 0;

  return (
    <div
      className={`flex items-center text-sm font-semibold ${
        isPositive ? "text-green-500" : "text-red-500"
      }`}
    >
      {isPositive ? (
        <ArrowUp className="h-4 w-4" />
      ) : (
        <ArrowDown className="h-4 w-4" />
      )}

      {Math.abs(percentage).toFixed(2)}%
    </div>
  );
}