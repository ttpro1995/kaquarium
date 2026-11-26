import { defineConfig } from 'vitest/config';

export default defineConfig({
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
