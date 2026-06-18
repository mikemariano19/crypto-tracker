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