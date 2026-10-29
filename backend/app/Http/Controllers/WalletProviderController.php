<?php

namespace App\Http\Controllers;

use App\Support\WalletProviders;

class WalletProviderController extends Controller
{
    /**
     * Exchanges and wallets to suggest for wallet names. Changes slowly.
     */
    public function index()
    {
        return response()
            ->json(['success' => true, 'data' => WalletProviders::all()])
            ->setPublic()
            ->setMaxAge(3600);
    }

    /**
     * A curated provider's site icon, served from here so the browser never
     * contacts the provider itself.
     */
    public function icon(string $id)
    {
        $icon = preg_match('/^[a-z0-9-]{1,40}$/', $id) ? WalletProviders::storedIcon($id) : null;

        if (!$icon) {
            return response()->json(['success' => false, 'error' => 'No icon.'], 404);
        }

        [$bytes, $type] = $icon;

        // SecurityHeaders adds nosniff and CSP default-src 'none', so an SVG
        // opened directly can't run script on our origin.
        return response($bytes, 200, [
            'Content-Type' => $type,
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }
}
