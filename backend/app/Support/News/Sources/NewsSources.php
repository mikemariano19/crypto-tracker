<?php

namespace App\Support\News\Sources;

/**
 * Builds source adapters from config/news_sources.php.
 */
class NewsSources
{
    /**
     * @return NewsSource[]
     */
    public static function enabled(): array
    {
        $snippetMaxChars = (int) config('news.snippet_max_chars', 300);
        $userAgent = (string) config('news_sources.user_agent');

        $sources = [];

        foreach (config('news_sources.sources', []) as $source) {
            if (!($source['enabled'] ?? false)) {
                continue;
            }

            $credibility = self::clampCredibility($source['credibility'] ?? 0.5);

            $sources[] = match ($source['type']) {
                'rss' => new RssSource($source['key'], $source['name'], $source['url'], $credibility, $snippetMaxChars, $userAgent),
                'cryptocompare' => new CryptoCompareSource($source['key'], $source['url'], (string) $source['api_key'], $credibility, $snippetMaxChars),
                default => throw new \InvalidArgumentException("Unknown news source type: {$source['type']}"),
            };
        }

        return $sources;
    }

    private static function clampCredibility(mixed $value): float
    {
        return max(0.5, min(1.0, (float) $value));
    }
}
