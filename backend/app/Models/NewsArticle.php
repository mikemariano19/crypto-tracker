<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NewsArticle extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'title_tokens' => 'array',
            'credibility' => 'float',
            'published_at' => 'datetime',
        ];
    }

    public function cluster(): BelongsTo
    {
        return $this->belongsTo(NewsCluster::class, 'cluster_id');
    }
}
