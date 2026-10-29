<?php

namespace Tests\Unit\News;

use App\Support\News\NewsImages;
use PHPUnit\Framework\TestCase;

class NewsImagesTest extends TestCase
{
    public function test_reads_share_image_preferring_og_over_twitter(): void
    {
        $html = <<<'HTML'
            <meta name="twitter:image" content="https://cdn.example.com/tw.jpg">
            <meta property="og:image" content="https://cdn.example.com/og.jpg?w=1200&amp;h=630">
            HTML;

        $this->assertSame('https://cdn.example.com/og.jpg?w=1200&h=630', NewsImages::fromHtml($html, 'https://example.com/a'));
    }

    public function test_resolves_relative_share_images(): void
    {
        $this->assertSame(
            'https://example.com/img/share.png',
            NewsImages::fromHtml('<meta property="og:image" content="/img/share.png">', 'https://example.com/news/a')
        );
        $this->assertSame(
            'https://cdn.example.com/x.png',
            NewsImages::fromHtml('<meta content="//cdn.example.com/x.png" property="og:image">', 'https://example.com/a')
        );
    }

    public function test_ignores_pages_without_safe_images(): void
    {
        $this->assertNull(NewsImages::fromHtml('<meta property="og:title" content="Hi">', 'https://example.com/a'));
        $this->assertNull(NewsImages::fromHtml('<meta property="og:image" content="javascript:alert(1)">', 'https://example.com/a'));
    }
}
