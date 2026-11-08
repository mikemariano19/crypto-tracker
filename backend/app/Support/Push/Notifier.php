<?php

namespace App\Support\Push;

use App\Models\PushNotification;
use App\Models\PushSubscription;

/**
 * Sends one alert if the subscriber's rules allow it, and remembers it for
 * the daily cap, the per-coin cooldown and the in-app history.
 */
class Notifier
{
    public function __construct(private PushSender $sender) {}

    public function isConfigured(): bool
    {
        return $this->sender->isConfigured();
    }

    /**
     * Category turned on, outside quiet hours, and under the daily cap. The
     * brief arrives at a time the subscriber chose, so quiet hours and the cap
     * don't apply to it. Their own price alerts may be let through quiet hours.
     */
    public function allows(PushSubscription $subscription, string $category): bool
    {
        if (!$subscription->wants($category)) {
            return false;
        }

        if ($category === 'brief') {
            return true;
        }

        if ($subscription->inQuietHours() && !($category === 'price' && $subscription->price_alerts_in_quiet)) {
            return false;
        }

        if ($category === 'news' && $this->sentToday($subscription, 'news') >= (int) config('push.news.daily_cap')) {
            return false;
        }

        return $this->sentToday($subscription) < (int) config('push.daily_cap');
    }

    /**
     * Since midnight on the subscriber's own clock: one category, or every
     * category but the brief.
     */
    public function sentToday(PushSubscription $subscription, ?string $category = null): int
    {
        return $subscription->notifications()
            ->when($category, fn ($query) => $query->where('category', $category), fn ($query) => $query->where('category', '!=', 'brief'))
            ->where('sent_at', '>=', $subscription->localNow()->startOfDay()->utc())
            ->count();
    }

    public function recentlyAlerted(PushSubscription $subscription, string $coinId): bool
    {
        return $subscription->notifications()
            ->whereJsonContains('coin_ids', $coinId)
            ->where('sent_at', '>=', now()->subMinutes((int) config('push.coin_cooldown_minutes')))
            ->exists();
    }

    /**
     * @param  array{title: string, body: string, url: string}  $message
     * @param  string[]  $coinIds
     * @return bool whether it was delivered
     */
    public function deliver(PushSubscription $subscription, string $category, array $message, array $coinIds = []): bool
    {
        $result = $this->sender->send($subscription, [
            ...$message,
            // A newer alert of the same kind replaces the old one on screen.
            'tag' => $category . ($coinIds === [] ? '' : ':' . implode(',', $coinIds)),
        ]);

        if ($result === PushSender::EXPIRED) {
            // Its alerts and history go with it.
            $subscription->delete();

            return false;
        }

        if ($result !== PushSender::SENT) {
            return false;
        }

        PushNotification::create([
            'push_subscription_id' => $subscription->id,
            'category' => $category,
            'coin_ids' => array_values($coinIds),
            'title' => mb_substr($message['title'], 0, 255),
            'body' => mb_substr($message['body'], 0, 500),
            'url' => $message['url'],
            'sent_at' => now(),
        ]);

        return true;
    }
}
