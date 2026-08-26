import { defineConfig } from 'vitest/config';
import type { Reporter } from 'vitest/reporters';

const requireExecutedTests: Reporter = {
  onTestRunEnd(modules) {
    const executed = modules.flatMap(module => [...module.children.allTests()]).some(test => ['passed', 'failed'].includes(test.result().state));
    if (!executed) {
      console.error('No behavior tests executed; skipped/empty evidence cannot pass.');
      process.exitCode = 1;
    }
  },
};

export default defineConfig({
  test: {
    // Native installation/lifecycle tests intentionally exercise the approved fixed
    // port. Serialize files so unrelated test fixtures do not contend for it.
    fileParallelism: false,
    passWithNoTests: false,
    reporters: ['default', requireExecutedTests],
    projects: ['unit', 'integration', 'native'].map(name => ({
      test: { name, include: [`tests/${name}/**/*.test.ts`], environment: 'node', testTimeout: 30_000, hookTimeout: 30_000, passWithNoTests: false },
    })),
  },
});
