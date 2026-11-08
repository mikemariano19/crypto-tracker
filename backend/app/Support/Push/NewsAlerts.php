<?php

namespace App\Support\Push;

use App\Models\NewsCluster;
use App\Models\NewsSentimentSnapshot;
use App\Models\PushSubscription;
use App\Support\News\NewsDemo;
use Illuminate\Support\Facades\Cache;

/**
 * Breaking high-impact news and market mood shifts, read from what the news
 * pipeline already analyzed: no new AI calls. Each story and each shift is
 * sent once, batched into one message per run.
 */
class NewsAlerts
{
    // What mood the last alert (or first look) saw, so a shift is a change from it.
    private const MOOD_KEY = 'push:mood';

    // Long enough that a story is never announced twice.
    private const SEEN_STORY_DAYS = 3;

    public function __construct(private Notifier $notifier) {}

    /** @return int notifications sent */
    public function run(): int
    {
        $stories = $this->breakingStories();
        $mood = $this->moodShift();

        if ($stories === [] && $mood === null) {
            return 0;
        }

        $message = PushMessages::news($stories, $mood);
        $sent = 0;

        foreach (PushSubscription::cursor() as $subscription) {
            if ($this->notifier->allows($subscription, 'news') && $this->notifier->deliver($subscription, 'news', $message)) {
                $sent++;
            }
        }

        return $sent;
    }

    /**
     * High-impact stories the pipeline analyzed since the last run, most
     * important first. A story first seen hours after it broke is skipped:
     * it isn't breaking any more.
     *
     * @return array<int, array{id: string, title: string, label: ?string, summary: ?string}>
     */
    private function breakingStories(): array
    {
        $settings = config('push.news');
        $since = now()->subHours($settings['max_age_hours']);

        $clusters = NewsCluster::with('primaryArticle')
            ->where('analysis_status', NewsCluster::STATUS_ANALYZED)
            ->where('impact', 'high')
            ->where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->where('latest_published_at', '>=', $since)
            ->where('analyzed_at', '>=', $since)
            // Sample analysis from `news:demo` isn't news.
            ->where(fn ($query) => $query->whereNull('summary')->orWhere('summary', 'not like', NewsDemo::PREFIX . '%'))
            ->orderByDesc('impact_rank')
            ->orderByDesc('trader_relevance')
            ->orderByDesc('latest_published_at')
            ->limit(10)
            ->get();

        $stories = [];

        foreach ($clusters as $cluster) {
            $title = $cluster->primaryArticle?->title;

            if (!$title || !Cache::add("push:news:{$cluster->id}", true, now()->addDays(self::SEEN_STORY_DAYS))) {
                continue;
            }

            $stories[] = [
                'id' => (string) $cluster->id,
                'title' => $title,
                'label' => $cluster->label,
                'summary' => $cluster->summary,
            ];
        }

        return $stories;
    }

    /**
     * The overall news sentiment label changed since it was last looked at.
     * The first look only records it. A mood flipping back and forth sends
     * one alert per cooldown.
     *
     * @return array{from: string, to: string, pct: int}|null
     */
    private function moodShift(): ?array
    {
        $snapshot = NewsSentimentSnapshot::latest('id')->first();

        if (!$snapshot || str_starts_with((string) $snapshot->ai_summary, NewsDemo::PREFIX)) {
            return null;
        }

        $seen = Cache::get(self::MOOD_KEY);

        if (($seen['id'] ?? null) === $snapshot->id) {
            return null;
        }

        Cache::forever(self::MOOD_KEY, ['id' => $snapshot->id, 'label' => $snapshot->label]);

        $from = $seen['label'] ?? null;

        if ($from === null || $from === $snapshot->label) {
            return null;
        }

        if (!Cache::add('push:mood:cooldown', true, now()->addHours((int) config('push.news.mood_cooldown_hours')))) {
            return null;
        }

        return [
            'from' => $from,
            'to' => $snapshot->label,
            'pct' => (int) ($snapshot->{$snapshot->label} ?? 0),
        ];
    }
}
