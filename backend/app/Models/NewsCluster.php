<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One story: every article about the same event, shown as a single card
 * with "+N sources".
 */
class NewsCluster extends Model
{
    use HasUlids;

    public const STATUS_PENDING = 'pending';
    public const STATUS_ANALYZED = 'analyzed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_SKIPPED = 'skipped';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'assets' => 'array',
            'tags' => 'array',
            'first_published_at' => 'datetime',
            'latest_published_at' => 'datetime',
            'analyzed_at' => 'datetime',
        ];
    }

    public function articles(): HasMany
    {
        return $this->hasMany(NewsArticle::class, 'cluster_id');
    }

    public function primaryArticle(): BelongsTo
    {
        return $this->belongsTo(NewsArticle::class, 'primary_article_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(NewsBatch::class, 'batch_id');
    }
}
