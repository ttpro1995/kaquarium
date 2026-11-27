import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    // Compiles U7's Svelte shell for the boot/integration tests that mount
    // the real App.svelte. No other package imports .svelte, so they are
    // unaffected.
    svelte({ compilerOptions: { hmr: false } }),
  ],
  resolve: {
    // Under vitest, resolve svelte's client build so `mount` (and client
    // component output) is available in the jsdom tests.
    conditions: ['browser'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts'],
    // Exposes globalThis.gc so allocation probes can force a scavenge and
    // measure retained growth instead of uncollected garbage. No test
    // behaviour changes; probes call gc only when present.
    poolOptions: {
      forks: { execArgv: ['--expose-gc'] },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
