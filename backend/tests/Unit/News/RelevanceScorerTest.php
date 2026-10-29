<?php

namespace Tests\Unit\News;

use App\Support\News\RelevanceScorer;
use PHPUnit\Framework\TestCase;

class RelevanceScorerTest extends TestCase
{
    private RelevanceScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->scorer = new RelevanceScorer(require __DIR__ . '/../../../config/news_keywords.php');
    }

    public function test_high_impact_headline_scores_above_default_threshold(): void
    {
        $result = $this->scorer->score('SEC approves spot Solana ETF', null, 1, 1.0);

        // SEC 25 + ETF 25 + SOL 15 + credibility 15
        $this->assertSame(80, $result['score']);
        $this->assertSame(['SOL'], $result['assets']);
        $this->assertSame(['ETF', 'Regulation'], $result['tags']);
    }

    public function test_penalty_terms_drop_low_value_content(): void
    {
        $result = $this->scorer->score('Bitcoin price prediction: BTC could reach $200K', null, 1, 1.0);

        $this->assertSame(0, $result['score']);
    }

    public function test_more_sources_raise_the_score_up_to_the_cap(): void
    {
        $one = $this->scorer->score('Ethereum upgrade goes live', null, 1, 0.8)['score'];
        $three = $this->scorer->score('Ethereum upgrade goes live', null, 3, 0.8)['score'];
        $ten = $this->scorer->score('Ethereum upgrade goes live', null, 10, 0.8)['score'];

        $this->assertSame($one + 16, $three);
        $this->assertSame($one + 24, $ten);
    }

    public function test_snippet_matches_count_for_less_than_title_matches(): void
    {
        $inTitle = $this->scorer->score('Exchange hack drains funds', null, 1, 0.5)['score'];
        $inSnippet = $this->scorer->score('Exchange update', 'Attackers used a hack to drain funds.', 1, 0.5)['score'];

        $this->assertGreaterThan($inSnippet, $inTitle);
        $this->assertGreaterThan(0, $inSnippet);
    }

    public function test_score_is_clamped_to_100(): void
    {
        $result = $this->scorer->score(
            'SEC ETF hack exploit liquidation Fed CPI: Bitcoin, Ethereum, Solana, XRP',
            null,
            10,
            1.0
        );

        $this->assertSame(100, $result['score']);
    }

    public function test_all_caps_terms_are_case_sensitive(): void
    {
        $this->assertTrue($this->scorer->matches('SOL', 'SOL jumps 10%'));
        $this->assertFalse($this->scorer->matches('SOL', 'a sol-gel process'));
        $this->assertTrue($this->scorer->matches('Bitcoin', 'BITCOIN rallies'));
    }

    public function test_matches_whole_words_with_simple_suffixes(): void
    {
        $this->assertTrue($this->scorer->matches('ETF', 'Spot ETFs see inflows'));
        $this->assertTrue($this->scorer->matches('hack', 'Exchange hacked overnight'));
        $this->assertTrue($this->scorer->matches('rate cut', 'Markets price in a rate-cut'));
        $this->assertFalse($this->scorer->matches('Fed', 'Federation launches token'));
        $this->assertFalse($this->scorer->matches('ban', 'Urban mining'));
    }
}
