import { defineConfig } from 'vitest/config'

// Dedicated config for the mock e2e runner. Kept out of the default `vitest run` (see
// vitest.config.ts) because it drives deployed infrastructure and external tooling, not unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/scripts/mockTests.ts'],
    // Each URL is a case; a missing deployment should fail loudly rather than pass empty.
    passWithNoTests: false,
    // The external mock package can run long; disable the per-test timeout.
    testTimeout: 0,
  },
})
