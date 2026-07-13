import { defineConfig } from 'vitest/config';

// Pure-TS sim tests run in Node; no DOM needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/game/**/*.test.ts'],
  },
});
