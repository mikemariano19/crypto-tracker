<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsSentimentSnapshot extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'by_asset' => 'array',
            'market' => 'array',
        ];
    }
}
