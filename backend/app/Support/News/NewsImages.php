<?php

namespace App\Support\News;

use App\Models\NewsArticle;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Fallback thumbnails: when a feed item carries no image, read the article
 * page's share image (og:image / twitter:image) instead.
 *
 * Kept polite: a few lookups per run, each article tried once, and a host
 * that refuses (403/429) is left alone for a day.
 */
class NewsImages
{
    private const MAX_LOOKUPS_PER_RUN = 10;

    private const BLOCKED_HOURS = 24;

    // Only the <head> is needed; never read whole article bodies.
    private const MAX_HTML_BYTES = 150_000;

    /**
     * @return int how many articles got an image
     */
    public static function backfill(): int
    {
        $articles = NewsArticle::whereNull('image_url')
            ->where('published_at', '>=', now()->subDays(3))
            ->latest('published_at')
            ->get()
            ->reject(fn (NewsArticle $article) => Cache::has(self::triedKey($article))
                || Cache::has(self::blockedKey(self::host($article->url))))
            ->take(self::MAX_LOOKUPS_PER_RUN);

        $found = 0;

        foreach ($articles as $article) {
            Cache::put(self::triedKey($article), true, now()->addDays(7));

            try {
                $response = Http::withUserAgent((string) config('news_sources.user_agent'))
                    ->accept('text/html')
                    ->timeout(8)
                    ->get($article->url);
            } catch (\Throwable $e) {
                Log::info('News image lookup failed', ['url' => $article->url, 'message' => $e->getMessage()]);

                continue;
            }

            if (in_array($response->status(), [403, 429], true)) {
                Cache::put(self::blockedKey(self::host($article->url)), true, now()->addHours(self::BLOCKED_HOURS));

                continue;
            }

            $image = $response->successful()
                ? self::fromHtml(substr($response->body(), 0, self::MAX_HTML_BYTES), $article->url)
                : null;

            if ($image) {
                $article->update(['image_url' => $image]);
                $found++;
            }
        }

        return $found;
    }

    /**
     * og:image (or og:image:secure_url / twitter:image) from a page's HTML.
     */
    public static function fromHtml(string $html, string $pageUrl): ?string
    {
        if (!preg_match_all('/<meta\b[^>]*>/i', $html, $tags)) {
            return null;
        }

        $ranked = [];

        foreach ($tags[0] as $tag) {
            if (!preg_match('/\b(?:property|name)=["\']([^"\']+)["\']/i', $tag, $name)
                || !preg_match('/\bcontent=["\']([^"\']+)["\']/i', $tag, $content)) {
                continue;
            }

            $rank = match (strtolower($name[1])) {
                'og:image:secure_url' => 0,
                'og:image', 'og:image:url' => 1,
                'twitter:image', 'twitter:image:src' => 2,
                default => null,
            };

            if ($rank !== null) {
                $ranked[$rank] ??= $content[1];
            }
        }

        ksort($ranked);

        foreach ($ranked as $url) {
            $url = html_entity_decode(trim($url), ENT_QUOTES | ENT_HTML5, 'UTF-8');

            // Protocol-relative or site-relative share images.
            if (str_starts_with($url, '//')) {
                $url = "https:{$url}";
            } elseif (str_starts_with($url, '/')) {
                $url = 'https://' . parse_url($pageUrl, PHP_URL_HOST) . $url;
            }

            if ($safe = NewsText::imageUrl($url)) {
                return $safe;
            }
        }

        return null;
    }

    private static function host(string $url): string
    {
        return strtolower((string) parse_url($url, PHP_URL_HOST));
    }

    private static function triedKey(NewsArticle $article): string
    {
        return "news:image-tried:{$article->id}";
    }

    private static function blockedKey(string $host): string
    {
        return "news:image-blocked:{$host}";
    }
}
