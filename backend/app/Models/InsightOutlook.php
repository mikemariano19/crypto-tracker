<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One AI outlook and, once its window has passed, how the price actually moved.
 */
class InsightOutlook extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'price' => 'float',
            'move_pct' => 'float',
            'matched' => 'boolean',
            'analyzed_at' => 'datetime',
            'resolve_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }
}
