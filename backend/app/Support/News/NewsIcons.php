<?php

namespace App\Support\News;

use App\Models\NewsArticle;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Outlet site icons (favicons) for the news cards.
 *
 * Icons are looked up during the news run, never while serving the API:
 * the outlet's homepage is read once for its <link rel="icon">, and the
 * result is cached for a month (a failed lookup is retried after a day).
 * A source can also set `icon` in config/news_sources.php.
 */
class NewsIcons
{
    private const FOUND_DAYS = 30;

    private const MISSING_HOURS = 24;

    // Most homepages to look up per run, so one run never stalls on icons.
    private const MAX_LOOKUPS_PER_RUN = 15;

    public static function forArticle(NewsArticle $article): ?string
    {
        return self::configured($article->source) ?? self::cached(self::host($article->url));
    }

    /**
     * Look up icons for hosts that don't have a cached answer yet.
     *
     * @param  string[]  $urls  article URLs
     */
    public static function warm(array $urls): void
    {
        $hosts = collect($urls)
            ->map(fn (string $url) => self::host($url))
            ->filter()
            ->unique()
            ->reject(fn (string $host) => Cache::has(self::key($host)))
            ->take(self::MAX_LOOKUPS_PER_RUN);

        foreach ($hosts as $host) {
            $icon = null;

            try {
                $icon = self::lookup($host);
            } catch (\Throwable $e) {
                Log::info('News icon lookup failed', ['host' => $host, 'message' => $e->getMessage()]);
            }

            Cache::put(
                self::key($host),
                $icon ?? '',
                $icon ? now()->addDays(self::FOUND_DAYS) : now()->addHours(self::MISSING_HOURS)
            );
        }
    }

    /**
     * Best icon declared in a homepage's HTML: a PNG/SVG "icon" first, then
     * "shortcut icon", then "apple-touch-icon". Relative links are resolved
     * against the site. Null when none is declared.
     */
    public static function fromHtml(string $html, string $baseUrl): ?string
    {
        if (!preg_match_all('/<link\b[^>]*>/i', $html, $tags)) {
            return null;
        }

        $ranked = [];

        foreach ($tags[0] as $tag) {
            if (!preg_match('/\brel=["\']([^"\']+)["\']/i', $tag, $rel)
                || !preg_match('/\bhref=["\']([^"\']+)["\']/i', $tag, $href)) {
                continue;
            }

            $rel = strtolower(trim($rel[1]));
            $url = self::absolute(html_entity_decode($href[1]), $baseUrl);

            if (!$url) {
                continue;
            }

            $rank = match (true) {
                $rel === 'icon' && preg_match('/\.(png|svg)(\?|$)/i', $url) === 1 => 0,
                $rel === 'icon' || $rel === 'shortcut icon' => 1,
                $rel === 'apple-touch-icon' => 2,
                default => null,
            };

            if ($rank !== null) {
                $ranked[$rank] ??= $url;
            }
        }

        ksort($ranked);

        return $ranked ? reset($ranked) : null;
    }

    private static function lookup(string $host): ?string
    {
        $baseUrl = "https://{$host}/";

        $response = Http::withUserAgent((string) config('news_sources.user_agent'))
            ->accept('text/html')
            ->timeout(8)
            ->get($baseUrl);

        if ($response->successful()) {
            $icon = self::fromHtml(mb_substr($response->body(), 0, 200_000), $baseUrl);

            if ($icon) {
                return $icon;
            }
        }

        // No icon declared: many sites still serve the classic location.
        $fallback = Http::withUserAgent((string) config('news_sources.user_agent'))->timeout(8)->head("{$baseUrl}favicon.ico");

        return $fallback->successful() && str_starts_with((string) $fallback->header('Content-Type'), 'image/')
            ? "{$baseUrl}favicon.ico"
            : null;
    }

    private static function configured(string $source): ?string
    {
        foreach (config('news_sources.sources', []) as $config) {
            if ($config['key'] === $source && !empty($config['icon'])) {
                return NewsText::imageUrl($config['icon']);
            }
        }

        return null;
    }

    private static function cached(?string $host): ?string
    {
        if (!$host) {
            return null;
        }

        $icon = Cache::get(self::key($host));

        return is_string($icon) && $icon !== '' ? $icon : null;
    }

    private static function absolute(string $href, string $baseUrl): ?string
    {
        $href = trim($href);

        // Only http(s) links; data:, javascript: and other schemes are dropped.
        if ($href === '' || (preg_match('#^[a-z][a-z0-9+.-]*:#i', $href) && !preg_match('#^https?://#i', $href))) {
            return null;
        }

        if (str_starts_with($href, '//')) {
            $href = "https:{$href}";
        } elseif (!preg_match('#^https?://#i', $href)) {
            $href = rtrim($baseUrl, '/') . '/' . ltrim($href, '/');
        }

        return NewsText::imageUrl($href);
    }

    private static function host(string $url): ?string
    {
        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) ? strtolower(preg_replace('/^www\./', '', $host)) : null;
    }

    private static function key(string $host): string
    {
        return "news:icon:{$host}";
    }
}
