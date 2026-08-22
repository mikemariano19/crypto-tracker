
import { formatCryptoStat } from "@/app/utils/format";

export default function CryptoStat({ label , value, isCurrency = true }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className="text-gray-600 font-medium">{label}:</span>
      <span className="text-gray-900 font-bold">
        {formatCryptoStat(value, isCurrency)}
      </span>
    </div>
  );
}
