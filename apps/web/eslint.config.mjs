import nextVitals from 'eslint-config-next/core-web-vitals';
import boundaries from 'eslint-plugin-boundaries';
import { baseConfig } from '../../eslint.config.mjs';

const COMPONENT_LEVELS = ['atom', 'molecule', 'organism', 'template'];

/** A component may only be imported through its folder's index.ts. */
const viaIndex = (types) => ({
  to: { element: { types: { anyOf: types }, fileInternalPath: 'index.ts' } },
});

/** Packages that talk to the database. Only src/server and src/app may use them. */
// The AI clients count as data access: they call the providers with decrypted keys.
const DATA_MODULES = ['@click-bot/db', '@click-bot/ai', 'pg', 'drizzle-orm', 'drizzle-orm/**'];

/**
 * Strict Atomic Design: every level may only import levels below it, never its own level.
 * Pages (src/app) may import everything. lib/ holds pure helpers usable everywhere.
 * server/ holds data access and view mapping and is reserved for pages.
 */
const atomicDesign = {
  files: ['src/**/*.{ts,tsx}'],
  plugins: { boundaries },
  settings: {
    // Patterns are relative to this folder, no matter where ESLint is started from.
    'boundaries/root-path': import.meta.dirname,
    'boundaries/elements': [
      { type: 'atom', pattern: 'src/components/atoms/*' },
      { type: 'molecule', pattern: 'src/components/molecules/*' },
      { type: 'organism', pattern: 'src/components/organisms/*' },
      { type: 'template', pattern: 'src/components/templates/*' },
      { type: 'app', pattern: 'src/app' },
      { type: 'lib', pattern: 'src/lib' },
      { type: 'server', pattern: 'src/server' },
      { type: 'styles', pattern: 'src/styles' },
    ],
    'import/resolver': {
      typescript: { project: `${import.meta.dirname}/tsconfig.json` },
    },
  },
  rules: {
    'boundaries/dependencies': [
      2,
      {
        default: 'disallow',
        policies: [
          { allow: { to: { module: { origin: ['external', 'core'] } } } },
          { allow: { dependency: { relationship: { to: 'internal' } } } },
          { allow: { to: { element: { type: 'lib' } } } },
          { from: { element: { type: 'molecule' } }, allow: viaIndex(['atom']) },
          { from: { element: { type: 'organism' } }, allow: viaIndex(['atom', 'molecule']) },
          {
            from: { element: { type: 'template' } },
            allow: viaIndex(['atom', 'molecule', 'organism']),
          },
          { from: { element: { type: 'app' } }, allow: viaIndex(COMPONENT_LEVELS) },
          { from: { element: { type: 'app' } }, allow: { to: { element: { type: 'styles' } } } },
          { from: { element: { type: 'app' } }, allow: { to: { element: { type: 'server' } } } },
        ],
      },
    ],
    'boundaries/no-unknown-files': 2,
  },
};

/**
 * Components and lib must not reach the database. eslint-plugin-boundaries ignores imports that
 * resolve outside src/ (pnpm links @click-bot/db there), so this uses ESLint's own rule.
 */
const noDataAccessInComponents = {
  files: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: DATA_MODULES,
            message: 'Datenzugriff nur in Seiten (src/app) über src/server.',
          },
        ],
      },
    ],
  },
};

// Next first, then the base config, so typescript-eslint's parser wins over Next's parser.
const config = [
  ...nextVitals,
  ...baseConfig,
  atomicDesign,
  noDataAccessInComponents,
  {
    files: ['src/**/*.test.{ts,tsx}', 'test/**/*.ts'],
    rules: { 'boundaries/no-unknown-files': 0 },
  },
];

export default config;
