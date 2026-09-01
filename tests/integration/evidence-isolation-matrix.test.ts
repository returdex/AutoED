import { afterAll, describe, expect, it } from 'vitest';
import { SECURITY_MATRIX_CASES } from '../../packages/test-support/src/security-matrix.js';

const EVIDENCE_CASE_IDS = [
  'EVIDENCE_OS_POLLUTION',
  'EVIDENCE_CLASS_POLLUTION',
  'EVIDENCE_SCENARIO_POLLUTION',
  'EVIDENCE_FIXTURE_L',
] as const;

const executed = new Set<string>();

afterAll(() => {
  expect(SECURITY_MATRIX_CASES.filter(item => EVIDENCE_CASE_IDS.includes(item.id as never)).map(item => item.id)).toEqual(EVIDENCE_CASE_IDS);
  expect([...executed]).toEqual(EVIDENCE_CASE_IDS);
});

describe('Phase 2 evidence isolation matrix', () => {
  it('binds every evidence pollution case to a durable behavior assertion', () => {
    expect(executed.size).toBe(4);
  });
});
