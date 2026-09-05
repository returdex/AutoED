import { defineConfig } from 'vitest/config';
import type { Reporter } from 'vitest/reporters';
import { createServer } from 'node:net';

const syntheticPort = await new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
    const address = server.address();
    if (!address || typeof address === 'string') return reject(new Error('SYNTHETIC_PORT_UNAVAILABLE'));
    server.close(error => error ? reject(error) : resolve(address.port));
  });
});
process.env.AUTOED_SYNTHETIC_TEST = '1';
process.env.AUTOED_SYNTHETIC_PORT = String(syntheticPort);

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
    allowOnly: false,
    // Runtime fixtures share one run-scoped ephemeral loopback port and stay serialized.
    // Separate contract assertions retain the production fixed-port requirement.
    fileParallelism: false,
    passWithNoTests: false,
    reporters: ['default', requireExecutedTests],
    projects: ['unit', 'integration', 'native'].map(name => ({
      test: { allowOnly: false, name, include: [`tests/${name}/**/*.test.ts`], setupFiles: ['./tests/setup/synthetic-process-ledger.ts'], environment: 'node', testTimeout: 30_000, hookTimeout: 30_000, passWithNoTests: false },
    })),
  },
});
