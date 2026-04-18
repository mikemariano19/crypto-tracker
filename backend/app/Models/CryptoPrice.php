<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CryptoPrice extends Model
{
    
    use HasFactory;

    protected $fillable = [
        'coin',
        'price',
        'currency',
    ];
}
