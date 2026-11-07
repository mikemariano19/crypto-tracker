<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * "Tell me when BTC goes above ₱4,000,000". Fires once, then stays listed
 * as hit so the user can see it happened.
 */
class PriceAlert extends Model
{
    public const DIRECTIONS = ['above', 'below'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'threshold' => 'float',
            'triggered_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(PushSubscription::class, 'push_subscription_id');
    }

    public function isHitBy(float $price): bool
    {
        return $this->direction === 'above' ? $price >= $this->threshold : $price <= $this->threshold;
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'coinId' => $this->coin_id,
            'symbol' => $this->coin_symbol,
            'direction' => $this->direction,
            'threshold' => $this->threshold,
            'currency' => $this->currency,
            'createdAt' => $this->created_at?->toIso8601ZuluString(),
            'triggeredAt' => $this->triggered_at?->toIso8601ZuluString(),
        ];
    }
}
