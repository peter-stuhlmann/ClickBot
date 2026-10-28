import nextVitals from 'eslint-config-next/core-web-vitals';
import boundaries from 'eslint-plugin-boundaries';
import { baseConfig } from '../../eslint.config.mjs';

const COMPONENT_LEVELS = ['atom', 'molecule', 'organism', 'template'];

/** A component may only be imported through its folder's index.ts. */
const viaIndex = (types) => ({
  to: { element: { types: { anyOf: types }, fileInternalPath: 'index.ts' } },
});

/**
 * Strict Atomic Design: every level may only import levels below it, never its own level.
 * Pages (src/app) may import everything. lib/ holds pure helpers usable everywhere.
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
        ],
      },
    ],
    'boundaries/no-unknown-files': 2,
  },
};

// Next first, then the base config, so typescript-eslint's parser wins over Next's parser.
const config = [
  ...nextVitals,
  ...baseConfig,
  atomicDesign,
  {
    files: ['src/**/*.test.{ts,tsx}', 'test/**/*.ts'],
    rules: { 'boundaries/no-unknown-files': 0 },
  },
];

export default config;
