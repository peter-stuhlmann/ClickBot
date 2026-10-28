import { existsSync } from 'node:fs';
import type { NextConfig } from 'next';

// The monorepo keeps one .env in its root; Next itself only reads apps/web/.env. Loading it
// here sets process.env before Next starts its workers, which inherit it. Variables already
// set (e.g. in production) are not overwritten.
const rootEnv = new URL('../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  reactStrictMode: true,
  // The workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@click-bot/shared', '@click-bot/db'],
  // node-postgres is a server-side Node module; keep it out of the bundle.
  serverExternalPackages: ['pg'],
  // Bottom left would cover the user block of the sidebar.
  devIndicators: { position: 'bottom-right' },
  // The e2e server uses its own folder (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default config;
