import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';

type TradingVolume = {
    volume_24h:  number;
};

interface ApiResponse {
    success: boolean;
    data: TradingVolume;
    cached_at?: string;
    error?: string;
}

const fetcher = async (url: string): Promise<TradingVolume> => {
    const res = await fetch(url);
    const json: ApiResponse = await res.json();

    if (!json.success) {
        throw new Error(json.error || 'Failed to fetch trading volume');
    }

    return json.data;
};

export function useTradingVolume() {
    const { data, mutate, error, isLoading } = useSWR(`${process.env.NEXT_PUBLIC_API_URL}/api/market-stats`, fetcher, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Trading volume fetch failed:', err.message);
        }
    });
    

    if(data){
        console.log('Trading volume API response:', data);
    }

    useEffect(() => {
        const channel = getEcho().channel('trading-volume');
        channel.listen('.trading-volume.updated', (event: { stats: TradingVolume }) => {
            mutate(event.stats, false); // update cache without refetch
        });

        return () => {
            channel.stopListening('.trading-volume.updated');
        };
    }, [mutate]);

    return {
        volume_24h: data?.volume_24h,
        isLoading,
        isError: !!error,
    };
}