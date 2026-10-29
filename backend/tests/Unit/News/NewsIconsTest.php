<?php

namespace Tests\Unit\News;

use App\Support\News\NewsIcons;
use PHPUnit\Framework\TestCase;

class NewsIconsTest extends TestCase
{
    public function test_prefers_png_or_svg_icon_and_resolves_relative_links(): void
    {
        $html = <<<'HTML'
            <link rel="apple-touch-icon" href="/apple-touch-icon.png">
            <link rel="shortcut icon" href="/favicon.ico">
            <link rel="icon" type="image/svg+xml" href="/favicon.svg">
            HTML;

        $this->assertSame('https://example.com/favicon.svg', NewsIcons::fromHtml($html, 'https://example.com/'));
    }

    public function test_falls_back_through_icon_kinds(): void
    {
        $this->assertSame(
            'https://example.com/favicon.ico',
            NewsIcons::fromHtml('<link rel="apple-touch-icon" href="/touch.png"><link rel="icon" href="/favicon.ico">', 'https://example.com/')
        );

        $this->assertSame(
            'https://cdn.example.com/touch.png',
            NewsIcons::fromHtml('<link rel="apple-touch-icon" href="//cdn.example.com/touch.png">', 'https://example.com/')
        );
    }

    public function test_ignores_empty_data_and_unsafe_icons(): void
    {
        $this->assertNull(NewsIcons::fromHtml('<link rel="icon" href="data:,">', 'https://example.com/'));
        $this->assertNull(NewsIcons::fromHtml('<link rel="icon" href="javascript:alert(1)">', 'https://example.com/'));
        $this->assertNull(NewsIcons::fromHtml('<p>no icons</p>', 'https://example.com/'));
    }
}
