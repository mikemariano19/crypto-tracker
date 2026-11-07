<?php

namespace App\Support\Push;

use App\Models\PushSubscription;

/**
 * Delivers one push message. An interface so tests never reach a real push
 * service.
 */
interface PushSender
{
    public const SENT = 'sent';

    // The browser unsubscribed or the subscription lapsed: delete it.
    public const EXPIRED = 'expired';

    // Worth trying again on a later run.
    public const FAILED = 'failed';

    public function isConfigured(): bool;

    /**
     * @param  array{title: string, body: string, url: string, tag: string}  $payload
     * @return string one of SENT, EXPIRED or FAILED
     */
    public function send(PushSubscription $subscription, array $payload): string;
}
