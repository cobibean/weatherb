import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load env from monorepo root first (lower priority)
dotenvConfig({ path: resolve(process.cwd(), '../../.env') });
dotenvConfig({ path: resolve(process.cwd(), '../../.env.local') });
// Next.js will automatically load .env and .env.local from apps/web (higher priority)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@weatherb/shared'],
  images: {
    qualities: [75, 85],
  },
};

export default nextConfig;
