/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@weatherb/shared'],
  images: {
    qualities: [75, 85],
  },
  // Environment variables are set directly in Vercel dashboard
  // or loaded from .env.local for local development
};

export default nextConfig;
