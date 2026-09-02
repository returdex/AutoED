import { expect, it } from 'vitest';
import { readSyntheticProcessLedger } from '../../packages/test-support/src/process-ledger.js';

it('does not inspect or report the persistent user installation service as synthetic', () => {
  expect(readSyntheticProcessLedger()).toEqual([]);
});
