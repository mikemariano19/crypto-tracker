import useSWR from 'swr';
import { useEffect } from 'react';
import { listen } from '@/lib/echo';
import { apiUrl, fetchApi } from '@/lib/api';

type TradingVolume = {
    volume_24h:  number;
};

export function useTradingVolume() {
    const { data, mutate, error, isLoading } = useSWR<TradingVolume>(apiUrl('/api/market-stats'), fetchApi, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Trading volume fetch failed:', err.message);
        }
    });

    useEffect(
        () => listen<{ stats: TradingVolume }>('trading-volume', '.trading-volume.updated', (event) => {
            mutate(event.stats, false); // update cache without refetch
        }),
        [mutate],
    );

    return {
        volume_24h: data?.volume_24h,
        isLoading,
        isError: !!error,
    };
}