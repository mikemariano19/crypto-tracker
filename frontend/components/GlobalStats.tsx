import useGlobalStats from "@/hooks/useGlobalStats";
import { useFormatNumber } from "@/hooks/useFormatNumber";


export default function GlobalStats() {
    const { 
         coinsCount, 
         marketCap,
         btc_dominance, 
         eth_dominance,
     } = useGlobalStats();
     const { format } = useFormatNumber();


  return (
    <>
        <div className="flex flex-row gap-4 text-xs text-gray-600 p-2">
            <p >Coins: <span className="text-gray-800 font-medium">{coinsCount}</span></p>
           <p className="flex flex-row justify-center items-center">
                Market Cap:{" "}
                <span className="text-gray-800 font-medium">
                {format(marketCap, { currency: "$", decimals: 3 })}
                </span>
            </p>
            <p>Dominance: <span className=" text-gray-800 font-medium">BTC {btc_dominance.toFixed(2)}%{" "} ETH {eth_dominance.toFixed(2)}%</span></p>
        </div>
    </>
  );
}