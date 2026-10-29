import { useMemo } from 'react';
import useSWR from 'swr';
import { fetchApi } from '@/lib/api';
import { coinsPageKey, type CryptoPrice } from '@/hooks/useCryptoPrices';

/**
 * Ticker → CoinGecko logo for the top coins. Reuses the market table's
 * page-1 cache entry, so it costs no extra request when that's loaded.
 */
export function useCoinLogos(): Record<string, string> {
    const { data } = useSWR<CryptoPrice[]>(coinsPageKey(1), fetchApi, {
        revalidateOnFocus: false,
        keepPreviousData: true,
    });

    return useMemo(() => {
        const logos: Record<string, string> = {};

        // Ranked order, so the biggest coin wins a shared ticker.
        for (const coin of data ?? []) {
            const symbol = coin.symbol.toUpperCase();
            if (coin.image && !logos[symbol]) logos[symbol] = coin.image;
        }

        return logos;
    }, [data]);
}
