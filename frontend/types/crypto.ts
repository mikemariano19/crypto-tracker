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
    // Optional: profiles cached in the browser before these existed lack them.
    categories?: string[];
    links?: CoinLinks;
    contracts?: CoinContract[];
}

// Official links; every URL is http(s), checked by the API.
export interface CoinLinks {
    homepage: string | null;
    whitepaper: string | null;
    explorers: string[];
    github: string | null;
    twitter: string | null;
    reddit: string | null;
    telegram: string | null;
}

// A token's contract on one chain, e.g. { platform: "ethereum", address: "0x…" }.
export interface CoinContract {
    platform: string;
    address: string;
}

// Shape returned by /api/coin/{id}/markets: top exchange pairs by volume.
export interface CoinMarket {
    exchange: string;
    logo: string | null;
    base: string;
    target: string;
    price: number | null;
    volume: number | null;
    spread: number | null;
    trade_url: string | null;
    last_traded_at: string | null;
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