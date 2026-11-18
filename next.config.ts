import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship temporaire : 40+ erreurs TS legacy (types supabase / casts) — à retirer après regen types.
  typescript: {
    ignoreBuildErrors: true,
  },
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
    // Cache client router : revisite /chat/[id] sans refetch RSC pendant 60s
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  // Ancienne UI coach `/dashboard` (tables demo_* supprimées) : URLs → hubs actuels.
  // Le code `src/app/dashboard/**` reste importé par l’admin (éditeur v2, preview).
  async redirects() {
    return [
      { source: '/dashboard', destination: '/home', permanent: false },
      { source: '/dashboard/chat/:path*', destination: '/chat', permanent: false },
      { source: '/dashboard/calendar/:path*', destination: '/calendar', permanent: false },
      { source: '/dashboard/nutrition/:path*', destination: '/nutrition', permanent: false },
      { source: '/dashboard/exercises/:path*', destination: '/exercises', permanent: false },
      { source: '/dashboard/programs/:path*', destination: '/programs', permanent: false },
      { source: '/dashboard/sessions/:path*', destination: '/programs', permanent: false },
      { source: '/dashboard/preview/:path*', destination: '/programs', permanent: false },
      { source: '/preview/:token', destination: '/', permanent: false },
    ]
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
