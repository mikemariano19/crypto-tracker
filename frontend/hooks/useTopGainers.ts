import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';

export type Coin = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  price_change_percentage_24h: number;
};

type TopGainersApiResponse = {
  success: boolean;
  data: {
    headers: {
      'X-RateLimit-Limit'?: string;
      'X-RateLimit-Remaining'?: string;
      'X-RateLimit-Reset'?: string;
    };
    original: {
      success: boolean;
      data: {
        id: string;
        name: string;
        symbol: string;
        image: string;
        current_price: number;
        price_change_percentage_24h: number;
      }[];
    };
  };
};


const fetcher = async (url: string): Promise<Coin[]> => {
  const res = await fetch(url);
  const json: TopGainersApiResponse = await res.json();

   return json.data.original.data.map((coin) => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    image: coin.image,
    price: coin.current_price,
    price_change_percentage_24h: coin.price_change_percentage_24h,
  }));
};


export function useTopGainers() {
  const { data, error, isLoading, mutate } = useSWR<Coin[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/api/top-gainers`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      onError: (err: Error) => {
        console.warn('Top gainers fetch failed:', err.message);
      },
    }
  );

  useEffect(() => {
    const channel = getEcho().channel('top-gainers');

    channel.listen(
      '.top-gainers.updated',
      (event: { stats: Coin[] }) => {
        mutate(event.stats, false); // update cache without refetch
      }
    );

    return () => {
      channel.stopListening('.top-gainers.updated');
    };
  }, [mutate]);

  return {
    coins: data ?? [],
    changePercentage: data?.[0]?.price_change_percentage_24h ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  };
}