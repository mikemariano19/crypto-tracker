// Shapes returned by /api/push/* (see backend PushController).

export type PushCategory = 'price' | 'moves' | 'market' | 'news' | 'brief';

export interface PushPrefs {
  categories: Record<PushCategory, boolean>;
  timezone: string;
  /** "HH:MM" on the subscriber's clock; null start means no quiet hours. */
  quietStart: string | null;
  quietEnd: string | null;
  priceAlertsInQuiet: boolean;
  briefTime: string | null;
  currency: string;
  /** Favorites and wallet coins, by ID only, for big-move and level alerts. */
  watchCoins: string[];
}

export interface PriceAlert {
  id: number;
  coinId: string;
  symbol: string;
  direction: 'above' | 'below';
  /** In `currency`, exactly as the user typed it. */
  threshold: number;
  currency: string;
  createdAt: string | null;
  triggeredAt: string | null;
}

export interface SentAlert {
  id: number;
  category: PushCategory;
  title: string;
  body: string;
  url: string;
  sentAt: string;
}

export interface PushState {
  subscribed: true;
  prefs: PushPrefs;
  alerts: PriceAlert[];
  history: SentAlert[];
}

export interface PushKey {
  enabled: boolean;
  publicKey: string | null;
}

export type NewPriceAlert = Pick<PriceAlert, 'coinId' | 'symbol' | 'direction' | 'threshold' | 'currency'>;
