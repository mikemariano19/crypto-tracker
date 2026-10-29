<?php

namespace Tests\Unit\News;

use App\Support\News\Sources\RssSource;
use PHPUnit\Framework\TestCase;

class RssSourceTest extends TestCase
{
    public function test_parses_rss_items(): void
    {
        $xml = <<<'XML'
            <?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0"><channel>
              <item>
                <title><![CDATA[Bitcoin &amp; Ether rally]]></title>
                <link>https://www.example.com/a/?utm_source=rss</link>
                <description><![CDATA[<p>Prices <b>jumped</b>.</p>]]></description>
                <pubDate>Wed, 28 Oct 2026 20:03:08 +0000</pubDate>
              </item>
              <item>
                <title>No link or date</title>
              </item>
            </channel></rss>
            XML;

        $articles = (new RssSource('test', 'Test', 'https://example.com/feed', 0.8))->parse($xml);

        $this->assertCount(1, $articles);
        $this->assertSame('Bitcoin & Ether rally', $articles[0]->title);
        $this->assertSame('https://example.com/a', $articles[0]->url);
        $this->assertSame('Prices jumped.', $articles[0]->snippet);
        $this->assertSame('2026-10-28T20:03:08+00:00', $articles[0]->publishedAt->toIso8601String());
        $this->assertNull($articles[0]->imageUrl);
    }

    public function test_finds_images_in_media_enclosure_or_inline_html(): void
    {
        $xml = <<<'XML'
            <?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
              <item>
                <title>Media</title><link>https://example.com/1</link><pubDate>Wed, 28 Oct 2026 20:00:00 +0000</pubDate>
                <media:content url="https://cdn.example.com/a.jpg?w=800&amp;h=450" medium="image"/>
              </item>
              <item>
                <title>Thumbnail</title><link>https://example.com/2</link><pubDate>Wed, 28 Oct 2026 20:00:00 +0000</pubDate>
                <media:thumbnail url="https://cdn.example.com/b.jpg"/>
              </item>
              <item>
                <title>Enclosure</title><link>https://example.com/3</link><pubDate>Wed, 28 Oct 2026 20:00:00 +0000</pubDate>
                <enclosure url="https://cdn.example.com/c.webp" type="image/webp"/>
              </item>
              <item>
                <title>Inline</title><link>https://example.com/4</link><pubDate>Wed, 28 Oct 2026 20:00:00 +0000</pubDate>
                <content:encoded><![CDATA[<p><img class="x" src="https://cdn.example.com/d.png"></p>]]></content:encoded>
              </item>
              <item>
                <title>Unsafe</title><link>https://example.com/5</link><pubDate>Wed, 28 Oct 2026 20:00:00 +0000</pubDate>
                <media:content url="javascript:alert(1)" medium="image"/>
              </item>
            </channel></rss>
            XML;

        $images = array_map(
            fn ($article) => $article->imageUrl,
            (new RssSource('test', 'Test', 'https://example.com/feed', 0.8))->parse($xml)
        );

        $this->assertSame([
            'https://cdn.example.com/a.jpg?w=800&h=450',
            'https://cdn.example.com/b.jpg',
            'https://cdn.example.com/c.webp',
            'https://cdn.example.com/d.png',
            null,
        ], $images);
    }

    public function test_parses_atom_entries(): void
    {
        $xml = <<<'XML'
            <?xml version="1.0" encoding="UTF-8"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <entry>
                <id>urn:1</id>
                <title>ETH upgrade ships</title>
                <link rel="alternate" href="https://example.com/eth"/>
                <summary>Short.</summary>
                <published>2026-10-28T10:00:00Z</published>
              </entry>
            </feed>
            XML;

        $articles = (new RssSource('test', 'Test', 'https://example.com/feed', 0.8))->parse($xml);

        $this->assertCount(1, $articles);
        $this->assertSame('https://example.com/eth', $articles[0]->url);
    }

    public function test_invalid_xml_throws(): void
    {
        $this->expectException(\UnexpectedValueException::class);

        (new RssSource('test', 'Test', 'https://example.com/feed', 0.8))->parse('<html>not a feed');
    }
}
