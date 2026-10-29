import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'],
    // 'server-only' throws outside a React Server Component bundle; tests import server code directly.
    alias: { 'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)) },
    setupFiles: ['./test/setup.ts'],
    // user-event in jsdom takes about 1 s per form test; with coverage on all CPU cores it can
    // take several times that. A slower machine is no failure.
    testTimeout: 15_000,
  },
});
