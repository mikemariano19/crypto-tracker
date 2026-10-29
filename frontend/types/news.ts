// Shapes returned by the Laravel news API (see backend App\Support\News\NewsFeed).

export type SentimentLabel = 'bullish' | 'bearish' | 'neutral';
export type Level = 'low' | 'medium' | 'high';

export interface SentimentSplit {
  bullish: number;
  bearish: number;
  neutral: number;
}

export interface TraderTake {
  teaser: string;
  view: string;
}

export interface RelatedSource {
  source: string;
  sourceIcon: string | null; // the outlet's site icon
  headline: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string; // ISO UTC
}

export interface NewsStory {
  clusterId: string;
  headline: string;
  url: string;
  source: string;
  sourceIcon: string | null; // the outlet's site icon
  publishedAt: string;
  imageUrl: string | null; // the outlet's own thumbnail, hotlinked
  summary: string | null; // null when not AI-analyzed
  snippet: string | null; // the feed's own short description, unanalyzed stories only
  analyzed: boolean; // false for stories outside the top N per run
  sentiment: SentimentSplit | null; // null when not analyzed or analysis failed
  label: SentimentLabel | null;
  impact: Level;
  confidence: Level;
  assets: string[];
  tags: string[];
  traderTake: TraderTake | null;
  relevance: number;
  related: RelatedSource[];
}

export interface AssetSentiment {
  asset: string;
  sentiment: SentimentSplit;
  storyCount: number;
}

export interface GlobalSentimentSnapshot {
  // null until the first batch with AI-analyzed stories.
  sentiment: SentimentSplit | null;
  label: SentimentLabel | null;
  aiSummary: string | null;
  byAsset: AssetSentiment[];
  sentimentStoryCount: number;
  sentimentUpdatedAt: string | null;
  market: {
    totalMarketCapUsd: number;
    marketCapChange24hPct: number;
    btcDominancePct: number;
    totalVolumeUsd: number;
  } | null;
  trendingTags: Array<{ tag: string; count: number }>;
  storiesLast24h: number;
  analyzedLast24h: number;
  updatedAt: string | null;
  nextUpdateAt: string;
}

export interface SentimentTrendPoint extends SentimentSplit {
  at: string;
  label: SentimentLabel;
}

export interface NewsPage {
  items: NewsStory[];
  nextCursor: string | null;
}

export type NewsRange = '6h' | '24h' | '3d';
export type NewsSort = 'latest' | 'impact';

export interface NewsFilters {
  label: SentimentLabel | null;
  asset: string | null;
  impact: Level | null;
  range: NewsRange;
  sort: NewsSort;
}

export interface NewsBatchPublishedEvent {
  batchId: number;
  newCount: number;
  updatedAt: string;
}
