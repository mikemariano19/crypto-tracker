<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CryptoPriceController;
use App\Http\Controllers\MarketController;
use App\Http\Controllers\TopGainerController;


Route::get('/', function () {
    view()->share('title', 'Crypto Dashboard');
    return response()->json(['message' => 'Hello from Laravel HOME']);
});

Route::get('/test', function () {
    return response()->json(['message' => 'Hello from Laravel']);
});


Route::get('/coin', [CryptoPriceController::class, 'index']);
Route::get('/coin/{id}', [CryptoPriceController::class, 'coin']);
Route::get('/top-gainers', [TopGainerController::class, 'index']);


Route::get('/market-stats', [MarketController::class, 'global']);
Route::get('/trending', [MarketController::class, 'trending']);

