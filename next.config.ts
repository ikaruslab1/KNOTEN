import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'reactflow', 'canvas-confetti'],
  },
  allowedDevOrigins: [
    '192.168.0.134',
    'localhost',
    '127.0.0.1',
    'knoten.scherry.click',
    '*.scherry.click',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
