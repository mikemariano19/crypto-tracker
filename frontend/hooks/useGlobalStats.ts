"use client";

import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';


type MarketCap = {
    market_cap: number;
    change_24h: number;
    active_cryptocurrencies: number;
    updated_at: number;
    btc_dominance: number;
    eth_dominance: number;
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
        throw new Error(json.error || 'Failed to fetch global stats');
    }

    return json.data;
};

export default function useGlobalStats() {
    const { data, mutate, error, isLoading } = useSWR(`${process.env.NEXT_PUBLIC_API_URL}/api/market-stats`, fetcher, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Global stats fetch failed:', err.message);
        }
    });
    

    if(data){
        console.log('Global stats API response:', data);
    }

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
        btc_dominance: data?.btc_dominance || 0,
        eth_dominance: data?.eth_dominance || 0,
        isLoading,
        isError: !!error,
    };
}