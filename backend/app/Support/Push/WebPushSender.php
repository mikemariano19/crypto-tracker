<?php

namespace App\Support\Push;

use App\Models\PushSubscription;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Standard web push (RFC 8030) signed with our VAPID key. The browser's own
 * push service carries the message, so there's no Firebase or paid service.
 */
class WebPushSender implements PushSender
{
    // A price alert hours late would mislead, so push services may drop it.
    private const TTL_SECONDS = 3_600;

    private ?WebPush $webPush = null;

    public function isConfigured(): bool
    {
        return filled(config('push.vapid.public_key')) && filled(config('push.vapid.private_key'));
    }

    public function send(PushSubscription $subscription, array $payload): string
    {
        try {
            $report = $this->client()->sendOneNotification(
                new Subscription(
                    $subscription->endpoint,
                    $subscription->public_key,
                    $subscription->auth_token,
                    $subscription->content_encoding ?: 'aes128gcm',
                ),
                json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ['TTL' => self::TTL_SECONDS, 'urgency' => 'normal'],
            );
        } catch (\Throwable $e) {
            Log::warning('Push not sent', ['subscription' => $subscription->id, 'message' => $e->getMessage()]);

            return self::FAILED;
        }

        if ($report->isSuccess()) {
            return self::SENT;
        }

        if ($report->isSubscriptionExpired()) {
            return self::EXPIRED;
        }

        Log::warning('Push rejected', ['subscription' => $subscription->id, 'reason' => $report->getReason()]);

        return self::FAILED;
    }

    private function client(): WebPush
    {
        return $this->webPush ??= new WebPush(
            ['VAPID' => [
                'subject' => config('push.vapid.subject'),
                'publicKey' => config('push.vapid.public_key'),
                'privateKey' => config('push.vapid.private_key'),
            ]],
            // One slow push service shouldn't hold up everyone else's alerts.
            client: new Client(['timeout' => 10, 'connect_timeout' => 5]),
        );
    }
}
