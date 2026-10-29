import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { getEcho } from '@/lib/echo';
import { GLOBAL_SENTIMENT_KEY } from '@/hooks/useGlobalSentiment';
import type { NewsBatchPublishedEvent } from '@/types/news';

/**
 * Listens for new news batches. The header and trend refresh right away;
 * the feed only counts new stories so content never jumps under the reader.
 */
export function useNewsRealtime() {
  const { mutate } = useSWRConfig();
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const channel = getEcho().channel('news');

    channel.listen('.news.batch.published', (event: NewsBatchPublishedEvent) => {
      mutate(GLOBAL_SENTIMENT_KEY);
      mutate((key) => typeof key === 'string' && key.includes('/api/news/sentiment/trend'));

      if (event.newCount > 0) {
        setNewCount((count) => count + event.newCount);
      }
    });

    return () => {
      channel.stopListening('.news.batch.published');
    };
  }, [mutate]);

  return {
    newCount,
    clearNewCount: () => setNewCount(0),
  };
}
