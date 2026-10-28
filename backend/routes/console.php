<?php

use App\Support\MarketData;
use App\Support\StaleCache;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('market:warm', function () {
    foreach (MarketData::endpoints() as $key => [$freshSeconds, $fetch]) {
        $this->line(str_pad($key, 18) . StaleCache::warm($key, $freshSeconds, $fetch));
    }
})->purpose('Refresh cached CoinGecko data before it expires');

Schedule::command('market:warm')->everyMinute()->withoutOverlapping();
