import { defineConfig } from 'vitest/config';

/**
 * Core-logic tests run in plain Node with no Vite plugins, React, or DOM.
 * That is deliberate: it proves `src/core` is framework-independent.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
