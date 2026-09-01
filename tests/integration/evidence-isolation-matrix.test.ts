import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { EvidenceWriterAuthority } from '../../packages/application/src/ports.js';
import { SyntheticEvidenceReceiptSchema } from '../../packages/contracts/src/index.js';
import { presentEvidenceReceipts } from '../../packages/contracts/src/presentation.js';
import {
  PHASE2_BUILD_OBLIGATIONS,
  evaluatePhase2Evidence,
  evidenceCellKey,
  possibleEvidenceKeys,
  requiredEvidenceKeys,
} from '../../packages/domain/src/live-evidence.js';
import type { AccountBinding, EvidenceCellKey, EvidenceClass, EvidenceReceipt, NativePlatform, SourceId, UatScenario } from '../../packages/domain/src/model.js';
import { SQLiteEvidenceLedger } from '../../packages/persistence/src/auth.js';
import { openDatabase } from '../../packages/persistence/src/database.js';
import { makeSyntheticReceipt } from '../../packages/test-support/src/auth-fixture.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { SECURITY_MATRIX_CASES, SECURITY_MATRIX_SENTINELS, assertSecurityMatrixCoverage, type SecurityCaseId, type ThreatId } from '../../packages/test-support/src/security-matrix.js';

const EVIDENCE_CASE_IDS = ['EVIDENCE_OS_POLLUTION', 'EVIDENCE_CLASS_POLLUTION', 'EVIDENCE_SCENARIO_POLLUTION', 'EVIDENCE_FIXTURE_L'] as const satisfies readonly SecurityCaseId[];
const THREAT_BINDINGS: Readonly<Record<ThreatId, readonly SecurityCaseId[]>> = Object.freeze({
  'T2-01': ['ORIGIN_OUT_OF_ORIGIN', 'INPUT_ARBITRARY_OPERATION', 'EFFECT_BUSINESS_WRITE', 'EFFECT_DOWNLOAD'],
  'T2-02': ['OUTPUT_SENSITIVE_SENTINEL'],
  'T2-03': ['BINDING_SAME_NAME_DIFFERENT_SUBJECT', 'BINDING_IDENTITY_MISMATCH'],
  'T2-04': ['PROFILE_HELD', 'PROFILE_PID_REUSE'],
  'T2-05': ['AUTH_EXPIRED', 'AUTH_NETWORK_TIMEOUT', 'WORKER_STALE_BEFORE_REQUEST', 'WORKER_STALE_BEFORE_COMMIT'],
  'T2-06': ['AUTH_UNAUTHENTICATED', 'AUTH_EXPIRED', 'AUTH_PERMISSION_DENIED', 'AUTH_NETWORK_TIMEOUT', 'AUTH_PARSER_DRIFT', 'RETENTION_LAST_SUCCESS'],
  'T2-07': ['INPUT_ARBITRARY_OPERATION', 'OUTPUT_SENSITIVE_SENTINEL', 'UI_UNPAIRED_PROTECTED_READ'],
  'T2-08': EVIDENCE_CASE_IDS,
});
const executions = new Map<SecurityCaseId, number>();
const complete = (id: typeof EVIDENCE_CASE_IDS[number]) => executions.set(id, (executions.get(id) ?? 0) + 1);
const cleanups: Array<() => Promise<void>> = [];
const context = { expectedGeneration: 0 };
const buildId = 'a'.repeat(64);
const checkedAt = '2026-09-01T00:00:00.000Z';
const actualPlatform: NativePlatform = process.platform === 'win32' ? 'windows' : 'macos';
const otherPlatform: NativePlatform = actualPlatform === 'macos' ? 'windows' : 'macos';

afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
afterAll(() => {
  expect(SECURITY_MATRIX_CASES.filter(item => EVIDENCE_CASE_IDS.includes(item.id as never)).map(item => item.id)).toEqual(EVIDENCE_CASE_IDS);
  expect(EVIDENCE_CASE_IDS.map(id => [id, executions.get(id) ?? 0])).toEqual(EVIDENCE_CASE_IDS.map(id => [id, 1]));
});

function fixture() {
  const harness = createHarness(); cleanups.push(() => harness.cleanup());
  const path = join(harness.root, 'evidence-matrix.sqlite');
  const db = openDatabase(path); cleanups.push(async () => { if (db.open) db.close(); });
  return { harness, path, db, ledger: new SQLiteEvidenceLedger(db, { now: () => Date.parse('2026-09-01T01:00:00.000Z') }) };
}

function receipt(key: EvidenceCellKey, producerId = `phase-02-${key.evidence.toLowerCase()}-matrix`, status: EvidenceReceipt['status'] = 'pass', when = checkedAt): EvidenceReceipt {
  return {
    receiptId: randomUUID(), buildId, version: '0.1.0', ...key, status,
    resultCode: status === 'pass' ? 'AUTOMATED_CHECK_PASSED' : status === 'fail' ? 'AUTOMATED_CHECK_FAILED' : 'HUMAN_ACTION_REQUIRED',
    bindingConsistency: status === 'pass' ? 'consistent' : 'not_observed', gaps: status === 'pass' ? [] : ['AUTOMATED_CHECK_NOT_PASSED'], checkedAt: when,
    provenance: { kind: 'automated', evidence: key.evidence as 'S' | 'I' | 'N', producerId },
  };
}

function authority(evidence: 'S' | 'I' | 'N', platform = actualPlatform, producerId = `phase-02-${evidence.toLowerCase()}-matrix`): EvidenceWriterAuthority {
  return { kind: 'automated', evidence, platform, producerId };
}

async function snapshot(value: ReturnType<typeof fixture>, obligationStatus = new Map<string, string>()): Promise<string> {
  const cells = [];
  for (const key of possibleEvidenceKeys()) cells.push([evidenceCellKey(key), await value.ledger.list(key)]);
  const obligations = PHASE2_BUILD_OBLIGATIONS.map(item => [item.id, obligationStatus.get(item.id) ?? 'not_run']);
  return createHash('sha256').update(JSON.stringify({ cells, obligations })).digest('hex');
}

async function expectRejectedWithoutMutation(value: ReturnType<typeof fixture>, baseline: string, candidate: EvidenceReceipt, writer: EvidenceWriterAuthority) {
  await expect(value.ledger.append(candidate, writer, context)).rejects.toBeTruthy();
  expect(await snapshot(value)).toBe(baseline);
}

function key(platform: NativePlatform, source: SourceId, scenario: UatScenario, evidence: EvidenceClass): EvidenceCellKey {
  return { platform, source, scenario, evidence };
}

function binding(): AccountBinding {
  const identity = (source: SourceId) => ({ source, subjectFingerprint: 'A'.repeat(43), organizationFingerprint: 'B'.repeat(43), tenantFingerprint: 'C'.repeat(43), approvedScopeId: '10000000-0000-4000-8000-000000000001', evidenceKind: 'stable_subject_organization_scope' as const });
  return { status: 'confirmed', moodle: identity('moodle'), edstem: identity('edstem'), basis: 'human_confirmed', confirmedByActionReceiptId: randomUUID(), courseAccess: 'allowed', checkedAt };
}

describe('Phase 2 evidence isolation matrix: authority and exact cells', () => {
  it('rejects every cross-platform claim and leaves all 176 cells and named obligations unchanged', async () => {
    const value = fixture(); const baseline = await snapshot(value);
    const actual = receipt(key(actualPlatform, 'moodle', 'a.login', 'S'));
    const other = receipt(key(otherPlatform, 'moodle', 'a.login', 'S'));
    await expectRejectedWithoutMutation(value, baseline, other, authority('S', actualPlatform));
    await expectRejectedWithoutMutation(value, baseline, actual, authority('S', otherPlatform));
    await expectRejectedWithoutMutation(value, baseline, { ...actual, platform: otherPlatform }, authority('S', actualPlatform));
    await expectRejectedWithoutMutation(value, baseline, { ...actual, platform: ['macos', 'windows'] } as unknown as EvidenceReceipt, authority('S'));
    complete('EVIDENCE_OS_POLLUTION');
  });

  it('rejects every evidence-class escalation and proves the fixture can append only S', async () => {
    const value = fixture(); const baseline = await snapshot(value);
    for (const [writerClass, payloadClass] of [
      ['S', 'I'], ['S', 'N'], ['S', 'L'], ['I', 'S'], ['I', 'N'], ['I', 'L'],
    ] as const) {
      const candidate = receipt(key(actualPlatform, 'moodle', 'a.binding', payloadClass), `phase-02-${payloadClass.toLowerCase()}-matrix`);
      await expectRejectedWithoutMutation(value, baseline, candidate, authority(writerClass, actualPlatform, candidate.provenance.kind === 'automated' ? candidate.provenance.producerId : 'invalid'));
    }
    const automatedWithHuman = { ...receipt(key(actualPlatform, 'moodle', 'a.binding', 'S')), provenance: { kind: 'automated', evidence: 'S', producerId: 'phase-02-s-matrix', actionReceiptId: randomUUID() } } as unknown as EvidenceReceipt;
    await expectRejectedWithoutMutation(value, baseline, automatedWithHuman, authority('S'));
    for (const actionReceiptId of ['', 'forged']) {
      const fakeLive = { ...receipt(key(actualPlatform, 'moodle', 'a.binding', 'S')), evidence: 'L', provenance: { kind: 'human_action', actionReceiptId } } as unknown as EvidenceReceipt;
      await expectRejectedWithoutMutation(value, baseline, fakeLive, authority('S'));
    }
    const correlated = { ...authority('S'), actionReceiptId: randomUUID() } as unknown as EvidenceWriterAuthority;
    await expectRejectedWithoutMutation(value, baseline, receipt(key(actualPlatform, 'moodle', 'a.binding', 'S')), correlated);
    complete('EVIDENCE_CLASS_POLLUTION');

    const synthetic = makeSyntheticReceipt({ platform: actualPlatform, source: 'moodle', scenario: 'a.login' });
    expect(synthetic.evidence).toBe('S');
    await value.ledger.append(synthetic, { kind: 'automated', evidence: 'S', platform: actualPlatform, producerId: synthetic.provenance.producerId }, context);
    expect(await value.ledger.list(key(actualPlatform, 'moodle', 'a.login', 'S'))).toEqual([synthetic]);
    for (const evidence of ['N', 'L'] as const) {
      expect(SyntheticEvidenceReceiptSchema.safeParse({ ...synthetic, evidence, provenance: { ...synthetic.provenance, evidence } }).success).toBe(false);
    }
    complete('EVIDENCE_FIXTURE_L');
  });

  it('keeps every source/scenario cell independent and rejects multi-cell payloads', async () => {
    const value = fixture();
    const scenarios: UatScenario[] = ['a.login', 'a.binding', 'a.course_visibility', 'b.reopen_1', 'b.reopen_2', 'b.reopen_3', 'b.worker_restart', 'b.codex_exit', 'c.os_restart', 'd.24h_recheck', 'reauth'];
    for (const [index, scenario] of scenarios.entries()) {
      const exact = key(actualPlatform, index % 2 === 0 ? 'moodle' : 'edstem', scenario, 'I');
      const item = receipt(exact, 'phase-02-i-matrix', 'pass', new Date(Date.parse(checkedAt) + index * 1_000).toISOString());
      await value.ledger.append(item, authority('I'), context);
      expect(await value.ledger.list(exact)).toEqual([item]);
      const otherSource = key(actualPlatform, exact.source === 'moodle' ? 'edstem' : 'moodle', scenario, 'I');
      expect(await value.ledger.list(otherSource)).toEqual([]);
      for (const otherScenario of scenarios.filter(candidate => candidate !== scenario)) {
        expect(await value.ledger.list(key(actualPlatform, exact.source, otherScenario, 'I'))).not.toContainEqual(item);
      }
    }
    const baseline = await snapshot(value);
    const multipleScenarios = { ...receipt(key(actualPlatform, 'moodle', 'a.login', 'I'), 'phase-02-i-matrix'), scenario: ['a.login', 'reauth'] } as unknown as EvidenceReceipt;
    const multipleSources = { ...receipt(key(actualPlatform, 'moodle', 'a.login', 'I'), 'phase-02-i-matrix'), source: ['moodle', 'edstem'] } as unknown as EvidenceReceipt;
    await expectRejectedWithoutMutation(value, baseline, multipleScenarios, authority('I'));
    await expectRejectedWithoutMutation(value, baseline, multipleSources, authority('I'));
    complete('EVIDENCE_SCENARIO_POLLUTION');
  });
});

describe('Phase 2 evidence isolation matrix: hard gate and append-only projection', () => {
  it('allows actual-platform S/I only while every N/L and Windows live cell stays pending and Phase 3 stays blocked', async () => {
    const value = fixture();
    const passed: EvidenceCellKey[] = [];
    for (const candidate of possibleEvidenceKeys().filter(item => item.platform === actualPlatform && (item.evidence === 'S' || item.evidence === 'I'))) {
      const item = receipt(candidate, `phase-02-${candidate.evidence.toLowerCase()}-matrix`);
      await value.ledger.append(item, authority(candidate.evidence as 'S' | 'I'), context);
      passed.push(candidate);
    }
    expect(passed).toHaveLength(44);
    for (const candidate of possibleEvidenceKeys().filter(item => item.platform === otherPlatform || item.evidence === 'N' || item.evidence === 'L')) {
      expect(await value.ledger.list(candidate)).toEqual([]);
    }
    const passedObligations = PHASE2_BUILD_OBLIGATIONS.filter(item => item.evidence === 'S' || item.evidence === 'I').map(item => item.id);
    const gate = evaluatePhase2Evidence(passed, passedObligations);
    expect(gate).toEqual({ eligible: false, missingLive: 44, missingBuild: PHASE2_BUILD_OBLIGATIONS.filter(item => item.evidence === 'N').length });
    expect(requiredEvidenceKeys().filter(item => item.platform === 'windows')).toHaveLength(22);
    expect(requiredEvidenceKeys().filter(item => item.platform === 'macos')).toHaveLength(22);
    expect({ phase1Complete: false, phase2Complete: false, phase3Eligibility: gate.eligible ? 'eligible' : 'blocked', sharedProfile: 'unverified', windows: process.platform === 'win32' ? 'local_actual_only' : 'not_run', disposition: 'human_needed' })
      .toMatchObject({ phase1Complete: false, phase2Complete: false, phase3Eligibility: 'blocked', sharedProfile: 'unverified', disposition: 'human_needed' });
  });

  it('keeps fail/human-needed events append-only and prevents lower-class or other-cell passes from overriding them', async () => {
    const value = fixture();
    const exact = key(actualPlatform, 'moodle', 'reauth', 'I');
    const failed = receipt(exact, 'phase-02-i-matrix', 'fail', checkedAt);
    await value.ledger.append(failed, authority('I'), context);
    const firstRow = value.db.prepare('SELECT event_id FROM uat_receipts WHERE receipt_id=?').get(failed.receiptId) as { event_id: string };
    const humanNeeded = receipt(exact, 'phase-02-i-matrix', 'human_needed', '2026-09-01T00:00:01.000Z');
    await value.ledger.append(humanNeeded, authority('I'), context);
    const rows = value.db.prepare('SELECT receipt_id,status,prior_event_id FROM uat_receipts WHERE platform=? AND source=? AND scenario=? AND evidence=? ORDER BY recorded_at,event_id')
      .all(exact.platform, exact.source, exact.scenario, exact.evidence);
    expect(rows).toEqual([
      { receipt_id: failed.receiptId, status: 'fail', prior_event_id: null },
      { receipt_id: humanNeeded.receiptId, status: 'human_needed', prior_event_id: firstRow.event_id },
    ]);
    await value.ledger.append(receipt(key(actualPlatform, 'moodle', 'reauth', 'S'), 'phase-02-s-matrix'), authority('S'), context);
    await value.ledger.append(receipt(key(actualPlatform, 'edstem', 'reauth', 'I'), 'phase-02-i-matrix'), authority('I'), context);
    await expect(value.ledger.append(receipt(key(otherPlatform, 'moodle', 'reauth', 'I'), 'phase-02-i-matrix'), authority('I', actualPlatform), context)).rejects.toBeTruthy();
    expect(await value.ledger.list(exact)).toEqual([failed, humanNeeded]);
    expect(value.db.prepare('SELECT count(*) AS n FROM uat_receipts WHERE receipt_id IN (?,?)').get(failed.receiptId, humanNeeded.receiptId)).toEqual({ n: 2 });
  });

  it('keeps sensitive sentinels out of ledger, backup and redacted projection and binds every T2 threat to actual cases', async () => {
    const value = fixture(); const baseline = await snapshot(value);
    const sensitive = { ...receipt(key(actualPlatform, 'moodle', 'a.login', 'S')), profilePath: SECURITY_MATRIX_SENTINELS.exception, rawIdentity: SECURITY_MATRIX_SENTINELS.identity } as unknown as EvidenceReceipt;
    await expectRejectedWithoutMutation(value, baseline, sensitive, authority('S'));
    const safe = receipt(key(actualPlatform, 'moodle', 'a.login', 'S'));
    await value.ledger.append(safe, authority('S'), context);
    const projection = presentEvidenceReceipts([safe], binding());
    for (const sentinel of Object.values(SECURITY_MATRIX_SENTINELS)) expect(JSON.stringify(projection)).not.toContain(sentinel);
    expect(Object.keys(projection[0]!).sort()).toEqual(['bindingConsistency', 'buildId', 'checkedAt', 'earliestRecheckAt', 'evidence', 'gaps', 'identityFingerprint', 'nextAction', 'platform', 'receiptId', 'resultCode', 'scenario', 'source', 'status', 'version'].sort());
    const backup = join(value.harness.root, 'evidence-backup.sqlite');
    await value.db.backup(backup);
    for (const path of [value.path, `${value.path}-wal`, backup]) {
      if (!existsSync(path)) continue;
      const bytes = readFileSync(path).toString('utf8');
      for (const sentinel of Object.values(SECURITY_MATRIX_SENTINELS)) expect(bytes).not.toContain(sentinel);
    }

    expect(assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES)).toBe(SECURITY_MATRIX_CASES);
    const known = new Set(SECURITY_MATRIX_CASES.map(item => item.id));
    for (const [threat, cases] of Object.entries(THREAT_BINDINGS)) {
      expect(cases.length, threat).toBeGreaterThan(0);
      for (const caseId of cases) {
        expect(known.has(caseId), `${threat}:${caseId}`).toBe(true);
        expect(SECURITY_MATRIX_CASES.find(item => item.id === caseId)?.threats).toContain(threat);
      }
    }
  });
});
