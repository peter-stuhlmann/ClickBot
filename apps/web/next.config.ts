import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The shared package ships TypeScript source; Next compiles it with the app.
  transpilePackages: ['@click-bot/shared'],
};

export default config;
