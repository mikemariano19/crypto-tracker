import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';

type MarketCap = {
    market_cap: number;
    change_24h: number;
    active_cryptocurrencies: number;
    updated_at: number;
};

interface ApiResponse {
    success: boolean;
    data: MarketCap;
    stale?: boolean;
    cached_at?: string;
    error?: string;
}

const fetcher = async (url: string): Promise<MarketCap> => {
    const res = await fetch(url);
    const json: ApiResponse = await res.json();

    if (!json.success) {
        throw new Error(json.error || 'Failed to fetch market stats');
    }

    return json.data;
};

export function useMarketCap() {
    const { data, mutate, error, isLoading } = useSWR(`${process.env.NEXT_PUBLIC_API_URL}/api/market-stats`, fetcher, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Market stats fetch failed:', err.message);
        }
    });
    

    console.log('Market stats API response:', data);

    useEffect(() => {
        const channel = getEcho().channel('market-stats');
        channel.listen('.market-stats.updated', (event: { stats: MarketCap }) => {
            mutate(event.stats, false); // update cache without refetch
        });

        return () => {
            channel.stopListening('.market-stats.updated');
        };
    }, [mutate]);

    return {
        marketCap: data?.market_cap ? data.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 }) : null,
        changePercentage: data?.change_24h || 0,
        isLoading,
        isError: !!error,
    };
}