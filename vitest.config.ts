import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    // The real substitution only happens in the Vite build (see vite.config.ts). Under test,
    // keep each global as its own placeholder text, unsubstituted - matching the old Jest setup
    // (no replace step ran during `jest`), which several snapshots/assertions pin on.
    __FPCDN__: JSON.stringify('__FPCDN__'),
    __INGRESS_API__: JSON.stringify('__INGRESS_API__'),
    __lambda_func_version__: JSON.stringify('__lambda_func_version__'),
  },
  test: {
    globals: true,
    setupFiles: ['vitest.setup.ts'],
    environment: 'node',
    include: ['proxy/**/*.test.ts', 'mgmt-lambda/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'istanbul',
      reporter: [['text', { file: 'coverage.txt' }], ['json'], ['json-summary'], ['lcov']],
      include: ['proxy/**/*.ts', 'mgmt-lambda/**/*.ts'],
      exclude: ['**/model/**', 'proxy/app.ts', '**/index.ts'],
    },
  },
})
