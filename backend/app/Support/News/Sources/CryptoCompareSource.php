<?php

namespace App\Support\News\Sources;

use App\Support\News\NewsText;
use App\Support\News\RawArticle;
use DateTimeInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * CryptoCompare news aggregator (many outlets in one call). Each article
 * keeps its original outlet as the source name.
 */
class CryptoCompareSource implements NewsSource
{
    public function __construct(
        private string $key,
        private string $url,
        private string $apiKey,
        private float $credibility,
        private int $snippetMaxChars = 300,
    ) {}

    public function key(): string
    {
        return $this->key;
    }

    public function fetch(DateTimeInterface $since): array
    {
        $json = Http::acceptJson()
            ->withHeaders(['authorization' => "Apikey {$this->apiKey}"])
            ->timeout(15)
            ->retry(2, 500, fn ($e) => $e instanceof ConnectionException)
            ->get($this->url, ['lang' => 'EN'])
            ->throw()
            ->json();

        $items = $json['Data'] ?? null;

        if (!is_array($items) || !array_is_list($items)) {
            throw new \UnexpectedValueException($json['Message'] ?? "Invalid response from {$this->key}");
        }

        $articles = [];

        foreach ($items as $item) {
            $title = NewsText::plain($item['title'] ?? null);
            $url = NewsText::normalizeUrl((string) ($item['url'] ?? ''));
            $publishedAt = NewsText::date(isset($item['published_on']) ? (string) $item['published_on'] : null);

            if ($title === '' || !$url || !$publishedAt || $publishedAt->lessThan($since)) {
                continue;
            }

            $articles[] = new RawArticle(
                source: $this->key,
                sourceName: mb_substr(NewsText::plain($item['source_info']['name'] ?? $item['source'] ?? 'CryptoCompare'), 0, 80),
                url: $url,
                title: mb_substr($title, 0, 500),
                snippet: NewsText::snippet($item['body'] ?? null, $this->snippetMaxChars),
                publishedAt: $publishedAt,
                credibility: $this->credibility,
                imageUrl: NewsText::imageUrl($item['imageurl'] ?? null),
            );
        }

        return $articles;
    }
}
