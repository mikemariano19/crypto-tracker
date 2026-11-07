<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An alert that was sent: the daily cap and the per-coin cooldown count
 * these, and the in-app history lists them for anyone who missed one.
 */
class PushNotification extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'coin_ids' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'sentAt' => $this->sent_at->toIso8601ZuluString(),
        ];
    }
}
