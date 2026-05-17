import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/tests/**/*.test.ts',
      'packages/**/src/**/*.test.ts',
      'apps/**/tests/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '_reference/**'],
    pool: 'threads',
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['packages/**/src/**/*.ts'],
      exclude: [
        'packages/**/src/**/*.types.ts',
        'packages/**/src/**/index.ts',
        'packages/**/src/**/*.test.ts',
      ],
      thresholds: {
        // Engines & shared/* target ≥85 %; relaxed at the root for now.
        lines: 80,
        statements: 80,
        branches: 75,
        functions: 80,
      },
    },
  },
});
