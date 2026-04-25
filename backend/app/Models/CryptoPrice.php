<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CryptoPrice extends Model
{
    
    use HasFactory;

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
