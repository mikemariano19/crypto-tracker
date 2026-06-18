import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: [
        "192.168.1.15",
        "localhost",
    ],
  images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'coin-images.coingecko.com',
                pathname: '/coins/images/**',
            },
        ],
    },
};

export default nextConfig;
