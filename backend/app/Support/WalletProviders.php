<?php

namespace App\Support;

use App\Support\News\NewsIcons;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Exchanges and wallets to suggest when naming a wallet in the tracker.
 *
 * Exchanges (with logos) come from CoinGecko, cached for a day. Curated
 * wallets/apps from config/wallet_providers.php get their site icon
 * downloaded once and served from our own /api, so a visitor's browser
 * never tells e.g. Ledger which wallets they track.
 */
class WalletProviders
{
    private const EXCHANGES_FRESH_SECONDS = 86_400;

    private const ICON_FOUND_DAYS = 30;

    private const ICON_MISSING_HOURS = 24;

    // Favicons are small; anything bigger isn't worth storing or serving.
    private const MAX_ICON_BYTES = 64 * 1024;

    private const ICON_TYPES = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', 'image/jpeg', 'image/webp', 'image/gif'];

    /**
     * Every provider: id ("cg:binance", "app:ledger"), name, kind, image URL
     * (or null for a letter tile), rank for ordering.
     *
     * @return list<array{id: string, name: string, kind: string, image: ?string, rank: ?int}>
     */
    public static function all(): array
    {
        $exchanges = StaleCache::remember('wallet_exchanges', self::EXCHANGES_FRESH_SECONDS, fn () => self::fetchExchanges()) ?? [];
        $seen = array_map(fn ($exchange) => mb_strtolower($exchange['name']), $exchanges);

        $curated = [];

        foreach (config('wallet_providers.curated', []) as $id => $provider) {
            // CoinGecko already lists it as an exchange (with its logo).
            if (in_array(mb_strtolower($provider['name']), $seen, true)) {
                continue;
            }

            $curated[] = [
                'id' => "app:{$id}",
                'name' => $provider['name'],
                'kind' => $provider['kind'],
                'image' => self::storedIcon($id) ? "/api/wallet-providers/{$id}/icon" : null,
                'rank' => null,
            ];
        }

        return [...$curated, ...$exchanges];
    }

    /**
     * @return list<array{id: string, name: string, kind: string, image: ?string, rank: ?int}>
     */
    private static function fetchExchanges(): array
    {
        $exchanges = CoinGecko::get('/exchanges', [
            'per_page' => (int) config('wallet_providers.exchanges_limit', 100),
            'page' => 1,
        ]);

        $out = [];

        foreach ($exchanges as $exchange) {
            if (!isset($exchange['id'], $exchange['name'])) {
                continue;
            }

            $image = $exchange['image'] ?? null;

            $out[] = [
                'id' => "cg:{$exchange['id']}",
                'name' => $exchange['name'],
                'kind' => 'exchange',
                // Only CoinGecko's own image host; it already serves the coin logos.
                'image' => is_string($image) && str_starts_with($image, 'https://') ? $image : null,
                'rank' => $exchange['trust_score_rank'] ?? null,
            ];
        }

        return $out;
    }

    /**
     * A curated provider's stored icon: [bytes, content type], or null.
     *
     * @return array{0: string, 1: string}|null
     */
    public static function storedIcon(string $id): ?array
    {
        $icon = Cache::get(self::iconKey($id));

        return is_array($icon) && isset($icon['bytes'], $icon['type'])
            ? [base64_decode($icon['bytes']), $icon['type']]
            : null;
    }

    /**
     * Download icons for curated providers that don't have one yet.
     *
     * @return array{found: int, missing: int, skipped: int}
     */
    public static function warmIcons(): array
    {
        $result = ['found' => 0, 'missing' => 0, 'skipped' => 0];

        foreach (config('wallet_providers.curated', []) as $id => $provider) {
            if (Cache::has(self::iconKey($id)) || Cache::has(self::missingKey($id))) {
                $result['skipped']++;

                continue;
            }

            $icon = self::downloadIcon($provider['url']);

            if ($icon) {
                Cache::put(self::iconKey($id), ['bytes' => base64_encode($icon[0]), 'type' => $icon[1]], now()->addDays(self::ICON_FOUND_DAYS));
                $result['found']++;
            } else {
                Cache::put(self::missingKey($id), true, now()->addHours(self::ICON_MISSING_HOURS));
                $result['missing']++;
            }
        }

        return $result;
    }

    /**
     * The site's declared icon (or /favicon.ico), if it's a small image.
     *
     * @return array{0: string, 1: string}|null
     */
    private static function downloadIcon(string $homepage): ?array
    {
        $client = fn () => Http::withUserAgent((string) config('news_sources.user_agent'))->timeout(8);

        try {
            $page = $client()->accept('text/html')->get($homepage);
            $candidates = array_filter([
                $page->successful() ? NewsIcons::fromHtml(substr($page->body(), 0, 200_000), $homepage) : null,
                self::origin($homepage) . '/favicon.ico',
            ]);

            foreach (array_unique($candidates) as $url) {
                $response = $client()->get($url);
                $type = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
                $bytes = $response->body();

                if ($response->successful() && in_array($type, self::ICON_TYPES, true) && $bytes !== '' && strlen($bytes) <= self::MAX_ICON_BYTES) {
                    return [$bytes, $type];
                }
            }
        } catch (\Throwable $e) {
            Log::info('Wallet provider icon lookup failed', ['url' => $homepage, 'message' => $e->getMessage()]);
        }

        return null;
    }

    private static function origin(string $url): string
    {
        return parse_url($url, PHP_URL_SCHEME) . '://' . parse_url($url, PHP_URL_HOST);
    }

    private static function iconKey(string $id): string
    {
        return "wallet-provider-icon:{$id}";
    }

    private static function missingKey(string $id): string
    {
        return "wallet-provider-icon-missing:{$id}";
    }
}
