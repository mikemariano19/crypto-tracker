<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CryptoPriceController;
use App\Http\Controllers\MarketController;
use App\Http\Controllers\NewsController;
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
Route::get('/coin/{id}/chart', [CryptoPriceController::class, 'chart']);
Route::get('/top-gainers', [TopGainerController::class, 'index']);


Route::get('/market-stats', [MarketController::class, 'global']);
Route::get('/trending', [MarketController::class, 'trending']);
Route::get('/fear-greed', [MarketController::class, 'fearGreed']);
Route::get('/search', [MarketController::class, 'search']);

Route::get('/news/sentiment/global', [NewsController::class, 'global']);
Route::get('/news/sentiment/trend', [NewsController::class, 'trend']);
Route::get('/news', [NewsController::class, 'index']);
Route::get('/news/{clusterId}', [NewsController::class, 'show']);

