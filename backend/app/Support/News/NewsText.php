<?php

namespace App\Support\News;

use Carbon\CarbonImmutable;

/**
 * Turns feed text into safe plain text and feed URLs into stable keys.
 */
class NewsText
{
    // Query params that only track clicks; dropping them makes the same
    // article from two feeds dedupe to one URL.
    private const TRACKING_PARAMS = ['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'source', 'cmpid'];

    /**
     * Plain text from feed HTML: tags removed, entities decoded, whitespace
     * collapsed. Nothing from a source is ever rendered as HTML.
     */
    public static function plain(?string $html): string
    {
        if ($html === null) {
            return '';
        }

        $text = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', ' ', $html) ?? '';
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    }

    /**
     * A short description, or null when the feed gives nothing useful.
     * WordPress feeds append "The post X appeared first on Y."; that's cut.
     */
    public static function snippet(?string $html, int $maxChars): ?string
    {
        $text = self::plain($html);
        $text = trim(preg_replace('/\s*The post .+ appeared first on .+$/u', '', $text) ?? '');

        if ($text === '') {
            return null;
        }

        if (mb_strlen($text) <= $maxChars) {
            return $text;
        }

        $cut = mb_substr($text, 0, $maxChars - 1);
        $lastSpace = mb_strrpos($cut, ' ');

        return rtrim($lastSpace > $maxChars / 2 ? mb_substr($cut, 0, $lastSpace) : $cut, " ,.;:-") . '…';
    }

    /**
     * Lowercased host, no fragment, no tracking params (utm_* and friends),
     * remaining params sorted, no trailing slash. Null for non-http(s) URLs.
     */
    public static function normalizeUrl(string $url): ?string
    {
        $parts = parse_url(trim($url));

        if (!$parts || !isset($parts['host']) || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return null;
        }

        $query = [];
        parse_str($parts['query'] ?? '', $query);

        $query = array_filter(
            $query,
            fn ($key) => !str_starts_with(strtolower((string) $key), 'utm_')
                && !in_array(strtolower((string) $key), self::TRACKING_PARAMS, true),
            ARRAY_FILTER_USE_KEY
        );
        ksort($query);

        $host = preg_replace('/^www\./', '', strtolower($parts['host']));
        $path = rtrim($parts['path'] ?? '', '/');
        $queryString = $query ? '?' . http_build_query($query) : '';

        // Always https: most outlets serve both, and the scheme alone
        // shouldn't make two copies of one article.
        return "https://{$host}{$path}{$queryString}";
    }

    /**
     * A thumbnail URL safe to put in an <img src>: absolute http(s) only.
     */
    public static function imageUrl(?string $url): ?string
    {
        $url = trim(html_entity_decode((string) $url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        if ($url === '' || mb_strlen($url) > 1000 || !preg_match('#^https?://[^\s"\'<>]+$#i', $url)) {
            return null;
        }

        return $url;
    }

    /**
     * First <img src> in feed HTML, for feeds that only embed the image.
     */
    public static function firstImage(?string $html): ?string
    {
        if ($html && preg_match('/<img\b[^>]*\bsrc=["\']([^"\']+)["\']/i', $html, $match)) {
            return self::imageUrl($match[1]);
        }

        return null;
    }

    /**
     * Parse a feed date into UTC. Future dates (bad feed clocks) are
     * clamped to now. Null if unparseable.
     */
    public static function date(?string $value): ?CarbonImmutable
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            $date = is_numeric($value)
                ? CarbonImmutable::createFromTimestampUTC((int) $value)
                : CarbonImmutable::parse($value)->utc();
        } catch (\Throwable) {
            return null;
        }

        $now = CarbonImmutable::now('UTC');

        return $date->greaterThan($now) ? $now : $date;
    }
}
