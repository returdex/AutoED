import { describe, expect, it } from 'vitest';
import { SECURITY_MATRIX_CASES } from '../../packages/test-support/src/security-matrix.js';

const INTEGRATION_CASE_IDS = [
  'ORIGIN_OUT_OF_ORIGIN',
  'EFFECT_BUSINESS_WRITE',
  'EFFECT_DOWNLOAD',
  'OUTPUT_SENSITIVE_SENTINEL',
  'PROFILE_HELD',
  'PROFILE_PID_REUSE',
  'WORKER_STALE_BEFORE_REQUEST',
  'WORKER_STALE_BEFORE_COMMIT',
  'RETENTION_LAST_SUCCESS',
  'UI_UNPAIRED_PROTECTED_READ',
] as const;

describe('Phase 2 auth security matrix: integration', () => {
  it('binds every integration case to an executed cross-layer behavior', () => {
    const executedCaseIds = new Set<string>();
    expect(SECURITY_MATRIX_CASES.filter(item => INTEGRATION_CASE_IDS.includes(item.id as never)).map(item => item.id))
      .toEqual(INTEGRATION_CASE_IDS);
    expect([...executedCaseIds]).toEqual(INTEGRATION_CASE_IDS);
  });
});
