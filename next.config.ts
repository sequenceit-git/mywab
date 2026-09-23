import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'ws',
    'pino',
    'qrcode',
    '@hapi/boom'
  ],
  env: {
    WS_NO_BUFFER_UTIL: '1',
    WS_NO_UTF_8_VALIDATE: '1',
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow all ngrok tunnels and local/custom domain origins
  experimental: {
    serverActions: {
      allowedOrigins: ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io', 'localhost:3000', '127.0.0.1:3000'],
    },
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, ngrok-skip-browser-warning, X-Requested-With' },
        ],
      },
    ];
  },
};

export default nextConfig;
