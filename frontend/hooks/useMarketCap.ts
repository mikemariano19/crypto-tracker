import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';
import { apiUrl, fetchApi } from '@/lib/api';

type MarketCap = {
    market_cap: number;
    change_24h: number;
    active_cryptocurrencies: number;
    updated_at: number;
};

export function useMarketCap() {
    const { data, mutate, error, isLoading } = useSWR<MarketCap>(apiUrl('/api/market-stats'), fetchApi, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Market stats fetch failed:', err.message);
        }
    });

    useEffect(() => {
        const echo = getEcho();
        if (!echo) return;

        const channel = echo.channel('market-stats');
        channel.listen('.market-stats.updated', (event: { stats: MarketCap }) => {
            mutate(event.stats, false); // update cache without refetch
        });

        return () => {
            channel.stopListening('.market-stats.updated');
        };
    }, [mutate]);

    return {
        marketCap: data?.market_cap || null,
        changePercentage: data?.change_24h || 0,
        isLoading,
        isError: !!error,
    };
}