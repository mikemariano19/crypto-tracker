import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';
import { apiUrl, fetchApi } from '@/lib/api';



export type CryptoPrice = {
    id: string;
    name: string;
    symbol: string;
    image: string;
    market_cap_rank: number | null;
    current_price: number;
    market_cap: number;
    total_volume: number;
    price_change_percentage_1h_in_currency: number | null;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d_in_currency: number | null;
};

// Must match MarketData::COINS_PER_PAGE / MAX_COIN_PAGES on the backend.
export const COINS_PER_PAGE = 50;
export const MAX_COIN_PAGES = 20;

// Page 1 keeps the plain URL so the table, the top bar's BTC/ETH prices and
// the persisted cache all share one entry.
export function coinsPageKey(page: number) {
    return page === 1 ? apiUrl('/api/coin') : apiUrl(`/api/coin?page=${page}`);
}

/**
 * Table rows for specific coins (the Favorites view). Pass an empty list
 * to skip fetching.
 */
export function useCoinsByIds(ids: string[]) {
    // Sorted so the same favorites in any order share one cache entry.
    const key = ids.length > 0
        ? apiUrl(`/api/coin?ids=${[...ids].sort().map(encodeURIComponent).join(',')}`)
        : null;

    const { data, error, isLoading } = useSWR<CryptoPrice[]>(key, fetchApi, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,
    });

    return {
        coins: data ?? [],
        isLoading,
        isError: !!error,
    };
}

export function useCryptoPrices(page = 1) {

    const { data, mutate, error, isLoading, isValidating } = useSWR<CryptoPrice[]>(coinsPageKey(page), fetchApi, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,  // ← key: never wipe existing data on refetch
        onError: (err) => {
            console.warn('Price fetch failed, keeping previous data:', err.message);
        }
    });

    useEffect(() => {
        // Live pushes only carry the top coins.
        if (page !== 1) return;

        const channel = getEcho().channel('crypto-prices');

        channel.listen('.prices.updated', (event: { prices: CryptoPrice[] }) => {
            mutate(event.prices, false); // update cache without refetch
        });

        return () => getEcho().leaveChannel('crypto-prices');
    }, [mutate, page]);



    return {
        prices: data ?? [],
        changePercentage: data?.[0]?.price_change_percentage_24h ?? 0,
        isLoading,
        isValidating,
        isError: !!error,
        isStale: false,
    }
}
