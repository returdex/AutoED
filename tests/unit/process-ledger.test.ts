import { expect, it } from 'vitest';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { sep } from 'node:path';
import { hasSyntheticRootName, parseSyntheticServiceArgv, readSyntheticProcessLedger } from '../../packages/test-support/src/process-ledger.js';

it('accepts only the exact full synthetic service argv grammar', () => {
  const argv = [
    '/synthetic/node',
    '/synthetic/main.js',
    '--autoed-service',
    '/synthetic/installation',
    '/synthetic/root',
    '123e4567-e89b-12d3-a456-426614174000',
  ];

  expect(parseSyntheticServiceArgv(argv)).toEqual({
    executable: '/synthetic/node',
    entrypoint: '/synthetic/main.js',
    installationPath: '/synthetic/installation',
    rootPath: '/synthetic/root',
    nonce: '123e4567-e89b-12d3-a456-426614174000',
  });
  expect(() => parseSyntheticServiceArgv([...argv, '--unexpected'])).toThrow('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
});

it('accepts only the generated alphanumeric synthetic root suffix', () => {
  const prefix = `${realpathSync(tmpdir())}${sep}autoed-synthetic-`;
  expect(hasSyntheticRootName(`${prefix}Abc123`)).toBe(true);
  expect(hasSyntheticRootName(`${prefix}Abc-123`)).toBe(false);
  expect(hasSyntheticRootName(`${prefix}autoed-synthetic-Abc123`)).toBe(false);
});

it('does not inspect or report the persistent user installation service as synthetic', () => {
  expect(readSyntheticProcessLedger()).toEqual([]);
});
