import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';

export type TrendingCoin = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  changePercentage: number;
};

type TrendingApiResponse = {
  success: boolean;
  coins: {
    item: {
      id: string;
      name: string;
      symbol: string;
      small: string;
      data: {
        price: number;
        price_change_percentage_24h?: {
          usd?: number;
        };
      };
    };
  }[];
};


const fetcher = async (url: string): Promise<TrendingCoin[]> => {
  const res = await fetch(url);
  const json: TrendingApiResponse = await res.json();


   return json.coins.map((coin) => ({
    id: coin.item.id,
    name: coin.item.name,
    symbol: coin.item.symbol,
    image: coin.item.small,
    price: coin.item.data.price,
    changePercentage: coin.item.data.price_change_percentage_24h?.usd ?? 0,
  }));
};

export function useTrendingCoins() {
  const { data, error, isLoading, mutate } = useSWR<TrendingCoin[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/api/trending`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      onError: (err: Error) => {
        console.warn('Trending coins fetch failed:', err.message);
      },
    }
  );

  useEffect(() => {
    const channel = getEcho().channel('trending-coins');

    channel.listen(
      '.trending-coins.updated',
      (event: { stats: TrendingCoin[] }) => {
        mutate(event.stats, false); // update cache without refetch
      }
    );

    return () => {
      channel.stopListening('.trending-coins.updated');
    };
  }, [mutate]);

  return {
    coins: data ?? [],
    changePercentage: data?.[0]?.changePercentage ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  };
}