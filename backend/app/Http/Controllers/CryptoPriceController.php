<?php

namespace App\Http\Controllers;
use App\Events\CryptoPriceUpdated;



class CryptoPriceController extends Controller
{
    public function updatePrice($coin, $price)
    {
        event(new CryptoPriceUpdated([
        'coin' => $coin,
        'price' => $price,
        ]));
    }
}
