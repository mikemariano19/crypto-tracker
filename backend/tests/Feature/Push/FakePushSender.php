<?php

namespace Tests\Feature\Push;

use App\Models\PushSubscription;
use App\Support\Push\PushSender;

/**
 * Records what would have been pushed, so tests never reach a push service.
 */
class FakePushSender implements PushSender
{
    /** @var array<int, array{subscription: int, payload: array}> */
    public array $sent = [];

    public string $result = self::SENT;

    public bool $configured = true;

    public function isConfigured(): bool
    {
        return $this->configured;
    }

    public function send(PushSubscription $subscription, array $payload): string
    {
        if ($this->result === self::SENT) {
            $this->sent[] = ['subscription' => $subscription->id, 'payload' => $payload];
        }

        return $this->result;
    }

    /** @return string[] */
    public function titles(): array
    {
        return array_map(fn (array $push) => $push['payload']['title'], $this->sent);
    }
}
