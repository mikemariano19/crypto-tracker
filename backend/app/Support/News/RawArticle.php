<?php

namespace App\Support\News;

use Carbon\CarbonImmutable;

/**
 * An article as a source adapter hands it over: already plain text, UTC
 * times, and a normalized URL.
 */
final readonly class RawArticle
{
    public function __construct(
        public string $source,
        public string $sourceName,
        public string $url,
        public string $title,
        public ?string $snippet,
        public CarbonImmutable $publishedAt,
        public float $credibility,
        public ?string $imageUrl = null,
    ) {}

    public function urlHash(): string
    {
        return hash('sha256', $this->url);
    }
}
