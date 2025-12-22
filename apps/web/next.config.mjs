/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@weatherb/shared'],
  images: {
    qualities: [75, 85],
  },
};

export default nextConfig;
