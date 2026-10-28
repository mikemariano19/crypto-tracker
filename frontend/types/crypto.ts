export interface Coin {
    id: string;
    name: string;
    symbol: string;
    image: string;
    current_price: number;
    price_change_percentage_24h: number; 
    price_change_percentage_1h_in_currency: number | null;
    price_change_percentage_7d_in_currency: number | null;
    market_cap: number;
    total_volume: number;
}

// Shape returned by /api/coin/{id}.
export interface CoinProfile {
    id: string;
    name: string;
    symbol: string;
    image: string | null;
    market_cap_rank: number | null;
    genesis_date: string | null;
    hashing_algorithm: string | null;
    description: string;
    last_updated: string | null;
    price: number | null;
    high_24h: number | null;
    low_24h: number | null;
    price_change_24h: number | null;
    price_change_percentage_1h: number | null;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d: number | null;
    price_change_percentage_30d: number | null;
    price_change_percentage_1y: number | null;
    market_cap: number | null;
    fully_diluted_valuation: number | null;
    total_volume: number | null;
    circulating_supply: number | null;
    total_supply: number | null;
    max_supply: number | null;
    ath: number | null;
    ath_change_percentage: number | null;
    ath_date: string | null;
    atl: number | null;
    atl_change_percentage: number | null;
    atl_date: string | null;
}

// Shape returned by /api/top-gainers and /api/trending.
export interface RankedCoin {
    id: string;
    name: string;
    symbol: string;
    image: string | null;
    market_cap_rank: number | null;
    price: number | null;
    market_cap: number | null;
    price_change_percentage_24h: number | null;
}