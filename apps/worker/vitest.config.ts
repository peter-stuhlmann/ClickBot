import { transform } from 'esbuild';
import { defineProject, type Plugin } from 'vitest/config';

/**
 * Compiles the worker's own code like tsx, which runs it: with keepNames, so inner functions get
 * `__name(…)`. A function sent into a page (page.evaluate) only has its own source there, without
 * __name; such a function fails in the tests as it would in the worker.
 */
const keepNamesLikeTsx: Plugin = {
  name: 'keep-names-like-tsx',
  enforce: 'post',
  async transform(code, id) {
    // Vite gives ids with forward slashes, also on Windows.
    if (!/\/apps\/worker\/src\/.*\.ts$/.test(id) || id.endsWith('.test.ts')) return null;
    const result = await transform(code, {
      loader: 'js',
      format: 'esm',
      keepNames: true,
      sourcemap: true,
    });
    return { code: result.code, map: result.map };
  },
};

export default defineProject({
  plugins: [keepNamesLikeTsx],
  test: {
    name: 'worker',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Worker tests that touch the queue use their own database (see test/db.ts).
    globalSetup: ['./test/global-setup.ts'],
    // The queue tests share that database; run the files one after another.
    fileParallelism: false,
    // Real Chromium: page loads take longer than pure unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
