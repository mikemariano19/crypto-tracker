<?php

namespace Tests\Unit\News;

use App\Support\News\NewsText;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

class NewsTextTest extends TestCase
{
    public function test_strips_tracking_params_and_normalizes_url(): void
    {
        $this->assertSame(
            'https://coindesk.com/markets/btc-etf?id=7&page=2',
            NewsText::normalizeUrl('http://www.CoinDesk.com/markets/btc-etf/?utm_source=rss&page=2&utm_medium=x&id=7&fbclid=abc#top')
        );
    }

    public function test_same_article_from_two_feeds_normalizes_to_one_url(): void
    {
        $this->assertSame(
            NewsText::normalizeUrl('https://decrypt.co/1234/story?utm_campaign=feed'),
            NewsText::normalizeUrl('http://decrypt.co/1234/story/')
        );
    }

    public function test_rejects_non_http_urls(): void
    {
        $this->assertNull(NewsText::normalizeUrl('javascript:alert(1)'));
        $this->assertNull(NewsText::normalizeUrl('not a url'));
    }

    public function test_plain_text_removes_html_and_scripts(): void
    {
        $this->assertSame(
            'Bitcoin & ETH rally',
            NewsText::plain('<p>Bitcoin &amp; <b>ETH</b><script>alert(1)</script>   rally</p>')
        );
    }

    public function test_snippet_drops_wordpress_footer_and_truncates(): void
    {
        $this->assertSame(
            'Short summary.',
            NewsText::snippet('<p>Short summary.</p><p>The post Foo appeared first on Bar.</p>', 300)
        );

        $snippet = NewsText::snippet(str_repeat('word ', 100), 50);
        $this->assertLessThanOrEqual(50, mb_strlen($snippet));
        $this->assertStringEndsWith('…', $snippet);

        $this->assertNull(NewsText::snippet('   ', 300));
    }

    public function test_dates_are_utc_and_never_in_the_future(): void
    {
        CarbonImmutable::setTestNow('2026-10-29 12:00:00');

        $this->assertSame('2026-10-28T20:03:08+00:00', NewsText::date('Wed, 28 Oct 2026 22:03:08 +0200')->toIso8601String());
        $this->assertSame('2026-10-29T12:00:00+00:00', NewsText::date('2030-01-01T00:00:00Z')->toIso8601String());
        $this->assertNull(NewsText::date('garbage date'));

        CarbonImmutable::setTestNow();
    }
}
