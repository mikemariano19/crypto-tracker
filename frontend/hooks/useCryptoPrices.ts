import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';



type CryptoPrice = {
    id: string;
    name: string;
    symbol: string;
    image: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    price_change_percentage_1h_in_currency: number | null;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d_in_currency: number | null;
};



interface ApiResponse {
    success: boolean;
    data: CryptoPrice[];
    stale?: boolean;
    cached_at?: string;
    error?: string;
}

const fetcher = async (url: string): Promise<CryptoPrice[]> => {
    const res = await fetch(url);
    const json: ApiResponse = await res.json();

    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error ?? 'Failed to fetch prices');
    }

    return json.data;
};

export function useCryptoPrices() {
    
    const { data, mutate, error, isLoading } = useSWR(`${process.env.NEXT_PUBLIC_API_URL}/api/coins`, fetcher, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Price fetch failed, keeping previous data:', err.message);
        }
    });

    
    if(data){
        console.log('API response:', data);
    }
    
    useEffect(() => {
        const channel = getEcho().channel('crypto-prices');
        
        channel.listen('.prices.updated', (event: { prices: CryptoPrice[] }) => {
            mutate(event.prices, false); // update cache without refetch
        });
        
        return () => getEcho().leaveChannel('crypto-prices');
    }, [mutate]);
    
    

    return {
        prices: data ?? [],
        isLoading,
        isError: !!error,
        isStale: false,
    }
}