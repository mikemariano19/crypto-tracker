"use client";

import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';
import { apiUrl, fetchApi } from '@/lib/api';


type MarketCap = {
    market_cap: number;
    change_24h: number;
    active_cryptocurrencies: number;
    updated_at: number;
    btc_dominance: number;
    eth_dominance: number;
};

export default function useGlobalStats() {
    const { data, mutate, error, isLoading } = useSWR<MarketCap>(apiUrl('/api/market-stats'), fetchApi, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Global stats fetch failed:', err.message);
        }
    });

    useEffect(() => {
        const channel = getEcho().channel('global-stats');
        channel.listen('.global-stats.updated', (event: { stats: MarketCap }) => {
            mutate(event.stats, false); // update cache without refetch
        });

        return () => {
            channel.stopListening('.global-stats.updated');
        };
    }, [mutate]);

    return {
        marketCap: data?.market_cap,
        changePercentage: data?.change_24h || 0,
        coinsCount: data?.active_cryptocurrencies || 0,
        // undefined until loaded, so the UI can show a placeholder instead of 0%
        btc_dominance: data?.btc_dominance,
        eth_dominance: data?.eth_dominance,
        isLoading,
        isError: !!error,
    };
}