/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14.2+ stable name (also covers older experimental alias)
  serverExternalPackages: ['@prisma/client', 'bullmq', 'ioredis'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bullmq', 'ioredis'],
  },
};

module.exports = nextConfig;
