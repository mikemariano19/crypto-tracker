"use client"

import CryptoChart from "@/components/CryptoChart"

export default function CoinGraphDefault({ params }: { params: { id: string } }) {
    const { id } = params;
    return (
        <CryptoChart coinId={id} />
    )
}