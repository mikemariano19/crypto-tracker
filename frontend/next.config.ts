import type { NextConfig } from "next";

const securityHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
    poweredByHeader: false,
    allowedDevOrigins: [
        "192.168.1.15",
        "localhost",
        // VS Code port forwarding, for testing on a phone.
        "*.devtunnels.ms",
    ],
    // The browser calls /api on this same origin and Next forwards it to
    // Laravel, so a forwarded or LAN address only needs port 3000 exposed.
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `${process.env.API_BACKEND_URL ?? "http://localhost:8000"}/api/:path*`,
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'coin-images.coingecko.com',
                pathname: '/coins/images/**',
            },
        ],
        // Coin logos change rarely; keep optimized copies for a day.
        minimumCacheTTL: 86400,
    },
    async headers() {
        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
