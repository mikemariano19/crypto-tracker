<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One browser that agreed to receive alerts, and how it wants them. The
 * endpoint is the only identity: whoever holds it can manage these settings.
 */
class PushSubscription extends Model
{
    public const CATEGORIES = ['price', 'market', 'brief'];

    protected $guarded = ['id'];

    protected $hidden = ['endpoint', 'endpoint_hash', 'public_key', 'auth_token'];

    protected function casts(): array
    {
        return [
            'categories' => 'array',
            'price_alerts_in_quiet' => 'boolean',
            'last_brief_on' => 'date',
        ];
    }

    public static function hashEndpoint(string $endpoint): string
    {
        return hash('sha256', $endpoint);
    }

    public static function findByEndpoint(string $endpoint): ?self
    {
        return self::where('endpoint_hash', self::hashEndpoint($endpoint))->first();
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(PriceAlert::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(PushNotification::class);
    }

    public function wants(string $category): bool
    {
        return (bool) ($this->categories[$category] ?? false);
    }

    /** The current moment on this subscriber's own clock. */
    public function localNow(): CarbonImmutable
    {
        return CarbonImmutable::now($this->timezone ?: 'UTC');
    }

    /**
     * Quiet hours can wrap past midnight (23:00-07:00) or not (13:00-15:00).
     */
    public function inQuietHours(): bool
    {
        if (!$this->quiet_start || !$this->quiet_end || $this->quiet_start === $this->quiet_end) {
            return false;
        }

        $now = $this->localNow()->format('H:i');

        return $this->quiet_start < $this->quiet_end
            ? $now >= $this->quiet_start && $now < $this->quiet_end
            : $now >= $this->quiet_start || $now < $this->quiet_end;
    }

    /** Settings as the frontend shows them. */
    public function prefs(): array
    {
        return [
            'categories' => array_merge(
                array_fill_keys(self::CATEGORIES, false),
                array_intersect_key($this->categories ?? [], array_flip(self::CATEGORIES)),
            ),
            'timezone' => $this->timezone,
            'quietStart' => $this->quiet_start,
            'quietEnd' => $this->quiet_end,
            'priceAlertsInQuiet' => $this->price_alerts_in_quiet,
            'briefTime' => $this->brief_time,
            'currency' => $this->currency,
        ];
    }
}
