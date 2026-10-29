<?php

namespace App\Support\News;

use Carbon\CarbonImmutable;
use Cron\CronExpression;
use DateTimeInterface;

/**
 * When the news pipeline runs. Shared by the scheduler and the API's
 * `nextUpdateAt`, so the page never promises a time the scheduler won't keep.
 */
class NewsSchedule
{
    public const MIN_HOURS = 2;
    public const MAX_HOURS = 12;

    public static function intervalHours(): int
    {
        return max(self::MIN_HOURS, min(self::MAX_HOURS, (int) config('news.fetch_interval_hours', 6)));
    }

    /**
     * On the hour, every N hours from midnight UTC.
     */
    public static function cron(): string
    {
        return '0 */' . self::intervalHours() . ' * * *';
    }

    public static function nextRunAfter(DateTimeInterface $time): CarbonImmutable
    {
        $next = (new CronExpression(self::cron()))->getNextRunDate($time, 0, false, 'UTC');

        return CarbonImmutable::instance($next)->utc();
    }
}
