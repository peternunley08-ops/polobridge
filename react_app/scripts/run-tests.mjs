#!/usr/bin/env node
/**
 * PoloPad Pro — engine test runner (`npm test`)
 * =============================================
 * Runs the TypeScript suites in `tests/` with zero extra tooling:
 *
 *   1. type-check   tsc -p tsconfig.tests.json
 *   2. bundle       the project's own Vite (SSR build) turns each *.test.ts
 *                   into a plain Node module
 *   3. execute      Node's built-in test runner (node --test)
 *
 * The built-in runner is used deliberately: every Vitest release that still
 * supports this project's Vite 5 carries open `npm audit` advisories, and the
 * patched releases require Vite 6+. This keeps the suite free of flagged
 * dependencies without touching the production build chain.
 *
 * Usage:  npm test                 run everything
 *         npm test -- court-link   run suites whose file name contains the text
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(root, 'tests');
const outDir = join(root, '.test-build');
const filters = process.argv.slice(2);

const suites = readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.ts'))
  .filter((name) => filters.length === 0 || filters.some((filter) => name.includes(filter)))
  .sort();

if (suites.length === 0) {
  console.error(`No test suites matched in ${testsDir}`);
  process.exit(1);
}

const typeCheck = spawnSync(
  process.execPath,
  [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.tests.json')],
  { stdio: 'inherit' }
);
if (typeCheck.status !== 0) {
  console.error('Type-check of the test suite failed.');
  process.exit(typeCheck.status ?? 1);
}

rmSync(outDir, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    ssr: true,
    outDir,
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: 'node20',
    rollupOptions: {
      input: Object.fromEntries(suites.map((name) => [name.replace(/\.ts$/, ''), join(testsDir, name)])),
      output: {
        format: 'es',
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
      },
    },
  },
});

const bundles = suites.map((name) => join(outDir, name.replace(/\.ts$/, '.mjs')));
const run = spawnSync(
  process.execPath,
  ['--enable-source-maps', '--test', '--test-reporter=spec', ...bundles],
  { stdio: 'inherit' }
);
process.exit(run.status ?? 1);
