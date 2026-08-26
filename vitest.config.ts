import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: false,
    reporters: ['default'],
    projects: ['unit', 'integration', 'native'].map(name => ({
      test: { name, include: [`tests/${name}/**/*.test.ts`], environment: 'node', testTimeout: 30_000, hookTimeout: 30_000, passWithNoTests: false },
    })),
  },
});
