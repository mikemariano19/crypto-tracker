<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coin extends Model
{
    protected $fillable = [
        'name',
        'symbol',
        'price',
        'market_cap',
        'volume_24h',
        'percent_change_1h',
        'percent_change_24h',
        'percent_change_7d',
    ];
}
