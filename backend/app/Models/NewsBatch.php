<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NewsBatch extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'next_update_at' => 'datetime',
            'errors' => 'array',
        ];
    }

    public function clusters(): HasMany
    {
        return $this->hasMany(NewsCluster::class, 'batch_id');
    }
}
