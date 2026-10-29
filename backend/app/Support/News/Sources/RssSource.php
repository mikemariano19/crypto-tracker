<?php

namespace App\Support\News\Sources;

use App\Support\News\NewsText;
use App\Support\News\RawArticle;
use DateTimeInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use SimpleXMLElement;

/**
 * Any RSS 2.0 or Atom feed.
 */
class RssSource implements NewsSource
{
    private const MEDIA_NS = 'http://search.yahoo.com/mrss/';

    public function __construct(
        private string $key,
        private string $name,
        private string $url,
        private float $credibility,
        private int $snippetMaxChars = 300,
        private string $userAgent = 'CryptoTracker/1.0',
    ) {}

    public function key(): string
    {
        return $this->key;
    }

    public function fetch(DateTimeInterface $since): array
    {
        $body = Http::withUserAgent($this->userAgent)
            ->accept('application/rss+xml, application/atom+xml, application/xml, text/xml')
            ->timeout(15)
            ->retry(2, 500, fn ($e) => $e instanceof ConnectionException)
            ->get($this->url)
            ->throw()
            ->body();

        return array_values(array_filter(
            $this->parse($body),
            fn (RawArticle $article) => $article->publishedAt->greaterThanOrEqualTo($since)
        ));
    }

    /**
     * @return RawArticle[]
     */
    public function parse(string $xml): array
    {
        $previous = libxml_use_internal_errors(true);

        try {
            // LIBXML_NONET: never fetch anything the feed points at.
            $feed = simplexml_load_string(ltrim($xml, "\xEF\xBB\xBF \t\r\n"), SimpleXMLElement::class, LIBXML_NOCDATA | LIBXML_NONET);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }

        if ($feed === false) {
            throw new \UnexpectedValueException("Invalid feed XML from {$this->key}");
        }

        $items = isset($feed->channel->item) ? $feed->channel->item : $feed->entry;
        $articles = [];

        foreach ($items ?? [] as $item) {
            $article = isset($item->link['href']) || isset($item->id)
                ? $this->fromAtom($item)
                : $this->fromRss($item);

            if ($article) {
                $articles[] = $article;
            }
        }

        return $articles;
    }

    private function fromRss(SimpleXMLElement $item): ?RawArticle
    {
        $dc = $item->children('http://purl.org/dc/elements/1.1/');
        $content = $item->children('http://purl.org/rss/1.0/modules/content/');

        return $this->make(
            (string) $item->title,
            (string) ($item->link ?: $item->guid),
            (string) $item->description,
            (string) ($item->pubDate ?: $dc->date),
            $this->mediaImage($item)
                ?? NewsText::firstImage((string) $item->description)
                ?? NewsText::firstImage((string) $content->encoded),
        );
    }

    /**
     * media:content / media:thumbnail (also inside media:group), then an
     * image enclosure.
     */
    private function mediaImage(SimpleXMLElement $item): ?string
    {
        $media = $item->children(self::MEDIA_NS);

        foreach ([$media, $media->group] as $scope) {
            foreach ($scope->content ?? [] as $content) {
                $attributes = $content->attributes();
                $isImage = (string) $attributes['medium'] === 'image'
                    || str_starts_with((string) $attributes['type'], 'image/');

                if ($isImage && ($url = NewsText::imageUrl((string) $attributes['url']))) {
                    return $url;
                }
            }

            foreach ($scope->thumbnail ?? [] as $thumbnail) {
                if ($url = NewsText::imageUrl((string) $thumbnail->attributes()['url'])) {
                    return $url;
                }
            }
        }

        foreach ($item->enclosure as $enclosure) {
            if (str_starts_with((string) $enclosure['type'], 'image/') && ($url = NewsText::imageUrl((string) $enclosure['url']))) {
                return $url;
            }
        }

        return null;
    }

    private function fromAtom(SimpleXMLElement $entry): ?RawArticle
    {
        $link = '';

        foreach ($entry->link as $candidate) {
            if (in_array((string) ($candidate['rel'] ?? 'alternate'), ['', 'alternate'], true)) {
                $link = (string) $candidate['href'];
                break;
            }
        }

        return $this->make(
            (string) $entry->title,
            $link,
            (string) ($entry->summary ?: $entry->content),
            (string) ($entry->published ?: $entry->updated),
            $this->mediaImage($entry) ?? NewsText::firstImage((string) ($entry->content ?: $entry->summary)),
        );
    }

    private function make(string $title, string $link, string $description, string $date, ?string $imageUrl = null): ?RawArticle
    {
        $title = NewsText::plain($title);
        $url = NewsText::normalizeUrl($link);
        $publishedAt = NewsText::date($date);

        if ($title === '' || !$url || !$publishedAt) {
            return null;
        }

        return new RawArticle(
            source: $this->key,
            sourceName: $this->name,
            url: $url,
            title: mb_substr($title, 0, 500),
            snippet: NewsText::snippet($description, $this->snippetMaxChars),
            publishedAt: $publishedAt,
            credibility: $this->credibility,
            imageUrl: $imageUrl,
        );
    }
}
