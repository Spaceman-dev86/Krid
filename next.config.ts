import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev via tunnels : sinon /_next/* et HMR sont bloqués
  allowedDevOrigins: [
    '3c4a-2a01-e0a-abf-7030-cc5b-cece-a6cf-2bcb.ngrok-free.app',
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    '*.trycloudflare.com',
  ],
  experimental: {
    // Formation vidéos jusqu’à 200 Mo (bucket trainly-formation) + overhead multipart
    proxyClientMaxBodySize: '210mb',
    serverActions: {
      bodySizeLimit: '210mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
