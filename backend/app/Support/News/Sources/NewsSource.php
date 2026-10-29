<?php

namespace App\Support\News\Sources;

use App\Support\News\RawArticle;
use DateTimeInterface;

interface NewsSource
{
    public function key(): string;

    /**
     * Articles published at or after $since. May throw; the pipeline logs
     * the failure and carries on with the other sources.
     *
     * @return RawArticle[]
     */
    public function fetch(DateTimeInterface $since): array;
}
