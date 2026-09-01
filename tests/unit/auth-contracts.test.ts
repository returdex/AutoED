import { describe, expect, it } from 'vitest';
import {
  AccountBindingSchema,
  ApprovedSourceConfigSchema,
  EvidenceReceiptSchema,
  Phase2GateSchema,
  ProfileOwnershipSchema,
  SourceObservationSchema,
  SourceProbeRequestSchema,
  SourceProbeResultSchema,
  SyntheticEvidenceReceiptSchema,
} from '../../packages/contracts/src/index.js';
import { makeSyntheticReceipt } from '../../packages/test-support/src/auth-fixture.js';

const checkedAt = '2026-09-01T00:00:00.000Z';
const ids = {
  config: '11111111-1111-4111-8111-111111111111',
  scope: '22222222-2222-4222-8222-222222222222',
  receipt: '33333333-3333-4333-8333-333333333333',
};

describe('Phase 2 source contracts', () => {
  const actions = [
    ['moodle', 'moodle.auth_probe'],
    ['moodle', 'moodle.course_visibility_probe'],
    ['edstem', 'edstem.auth_probe'],
    ['edstem', 'edstem.course_visibility_probe'],
  ] as const;

  it('accepts only the four fixed source/action pairs and stable approved references', () => {
    for (const [source, action] of actions) {
      const request = { source, action, approvedConfigId: ids.config, approvedScopeId: ids.scope };
      expect(SourceProbeRequestSchema.parse(request)).toEqual(request);
      const otherSource = source === 'moodle' ? 'edstem' : 'moodle';
      expect(SourceProbeRequestSchema.safeParse({ ...request, source: otherSource }).success).toBe(false);
    }
  });

  it.each(['url', 'js', 'selector', 'browserHandle', 'requestBody', 'download', 'upload', 'write', 'post', 'reply', 'submit', 'quizStart'])(
    'rejects the untrusted browser or source-write key %s',
    field => {
      expect(SourceProbeRequestSchema.safeParse({
        source: 'moodle', action: 'moodle.auth_probe', approvedConfigId: ids.config, approvedScopeId: ids.scope,
        [field]: 'untrusted',
      }).success).toBe(false);
    },
  );

  it('admits only normalized HTTPS official origins through the confirmation contract', () => {
    const moodle = { id: ids.config, source: 'moodle', officialOrigin: 'https://moodle.example.edu', approvedScopeId: ids.scope, confirmedAt: checkedAt };
    const edstem = { ...moodle, source: 'edstem', officialOrigin: 'https://edstem.org' };
    expect(ApprovedSourceConfigSchema.safeParse(moodle).success).toBe(true);
    expect(ApprovedSourceConfigSchema.safeParse(edstem).success).toBe(true);
    for (const officialOrigin of [
      'http://moodle.example.edu', 'https://user:secret@moodle.example.edu', 'https://moodle.example.edu/path',
      'https://moodle.example.edu?query=1', 'https://moodle.example.edu/#fragment', 'https://127.0.0.1', 'https://localhost',
    ]) expect(ApprovedSourceConfigSchema.safeParse({ ...moodle, officialOrigin }).success).toBe(false);
    expect(ApprovedSourceConfigSchema.safeParse({ ...moodle, source: 'edstem' }).success).toBe(false);
    expect(ApprovedSourceConfigSchema.safeParse({ ...moodle, password: 'not-allowed' }).success).toBe(false);
  });

  it('keeps each observation dimension independent and preserves last success separately', () => {
    const observation = {
      source: 'moodle', auth: 'identity_mismatch', capability: 'available', health: 'error', freshness: 'stale',
      completeness: 'partial', outcome: 'error', checkedAt, resultCode: 'IDENTITY_MISMATCH', courseAccess: 'blocked',
      lastSuccess: { checkedAt: '2026-08-31T00:00:00.000Z', subjectFingerprint: 'a1b2c3d4' },
    };
    expect(SourceObservationSchema.parse(observation)).toEqual(observation);
    expect(SourceObservationSchema.safeParse({ ...observation, courseAccess: 'allowed' }).success).toBe(false);
    expect(SourceProbeResultSchema.safeParse({
      request: { source: 'moodle', action: 'moodle.auth_probe', approvedConfigId: ids.config, approvedScopeId: ids.scope },
      observation, identity: null, selectedCourseVisible: null,
    }).success).toBe(true);
  });
});

describe('Phase 2 binding and Profile ownership contracts', () => {
  const stable = (source: 'moodle' | 'edstem', subjectFingerprint = `${source}-subject`) => ({
    source, subjectFingerprint, organizationFingerprint: 'org-12345678', tenantFingerprint: null, approvedScopeId: ids.scope,
    evidenceKind: 'stable_subject_organization_scope',
  });

  it('cannot confirm a binding from display names or email addresses', () => {
    expect(AccountBindingSchema.safeParse({
      status: 'confirmed', moodle: null, edstem: null, basis: 'human_confirmed', confirmedByActionReceiptId: ids.receipt,
      courseAccess: 'allowed', displayName: 'Same Name', schoolEmail: 'same@example.edu', checkedAt,
    }).success).toBe(false);
    expect(AccountBindingSchema.safeParse({
      status: 'candidate', moodle: stable('moodle'), edstem: stable('edstem'), basis: 'stable_subject_organization_scope',
      confirmedByActionReceiptId: null, courseAccess: 'blocked', checkedAt,
    }).success).toBe(true);
    expect(AccountBindingSchema.safeParse({
      status: 'confirmed', moodle: stable('moodle'), edstem: stable('edstem'), basis: 'human_confirmed',
      confirmedByActionReceiptId: ids.receipt, courseAccess: 'allowed', checkedAt,
    }).success).toBe(true);
  });

  it('hard-blocks identity changes', () => {
    expect(AccountBindingSchema.safeParse({
      status: 'identity_mismatch', moodle: stable('moodle'), edstem: stable('edstem', 'changed-subject'), basis: 'identity_changed',
      confirmedByActionReceiptId: null, courseAccess: 'blocked', checkedAt,
    }).success).toBe(true);
    expect(AccountBindingSchema.safeParse({
      status: 'identity_mismatch', moodle: stable('moodle'), edstem: stable('edstem', 'changed-subject'), basis: 'identity_changed',
      confirmedByActionReceiptId: null, courseAccess: 'allowed', checkedAt,
    }).success).toBe(false);
  });

  const reservation = {
    installationId: ids.config, browserBuildId: 'a'.repeat(64), nonce: ids.receipt, generation: 2, fence: 5, reservedAt: checkedAt,
  };
  const owner = { ...reservation, pid: 1234, osStartIdentity: 'start-identity', executable: '/managed/browser', startedAt: checkedAt };

  it('requires human action for running or unconfirmed owners and cleanup proof for stale records', () => {
    expect(ProfileOwnershipSchema.safeParse({ state: 'reserved', disposition: 'proceed', resultCode: 'PROFILE_RESERVED', reservation, owner: null, leaseUntil: 10 }).success).toBe(true);
    expect(ProfileOwnershipSchema.safeParse({ state: 'owned', disposition: 'proceed', resultCode: 'PROFILE_OWNED', reservation, owner, leaseUntil: 10 }).success).toBe(true);
    expect(ProfileOwnershipSchema.safeParse({ state: 'in_use', disposition: 'human_needed', resultCode: 'PROFILE_IN_USE', reservation, owner, leaseUntil: 0 }).success).toBe(true);
    expect(ProfileOwnershipSchema.safeParse({ state: 'unconfirmed', disposition: 'human_needed', resultCode: 'PROFILE_OWNERSHIP_UNCONFIRMED', reservation, owner, leaseUntil: 0 }).success).toBe(true);
    expect(ProfileOwnershipSchema.safeParse({ state: 'unconfirmed', disposition: 'cleanup_allowed', resultCode: 'PROFILE_OWNERSHIP_UNCONFIRMED', reservation, owner, leaseUntil: 0 }).success).toBe(false);
    expect(ProfileOwnershipSchema.safeParse({ state: 'confirmed_exited', disposition: 'cleanup_allowed', resultCode: 'PROFILE_CONFIRMED_EXITED', reservation, owner, leaseUntil: 0 }).success).toBe(true);
  });

  it.each(['profilePath', 'cookie', 'storageState'])('rejects sensitive Profile field %s', field => {
    expect(ProfileOwnershipSchema.safeParse({ state: 'owned', disposition: 'proceed', resultCode: 'PROFILE_OWNED', reservation, owner, leaseUntil: 10, [field]: 'secret' }).success).toBe(false);
  });
});

describe('Phase 2 evidence isolation and hard gate', () => {
  it('fixes the synthetic factory to S evidence and rejects live promotion', () => {
    const synthetic = makeSyntheticReceipt({ platform: 'macos', source: 'moodle', scenario: 'a.login' });
    expect(synthetic.evidence).toBe('S');
    expect(synthetic.provenance).toEqual({ kind: 'automated', evidence: 'S', producerId: 'phase-02-contract-fixture' });
    expect(SyntheticEvidenceReceiptSchema.safeParse({ ...synthetic, evidence: 'L' }).success).toBe(false);
    expect(SyntheticEvidenceReceiptSchema.safeParse({ ...synthetic, provenance: { kind: 'human_action', actionReceiptId: ids.receipt } }).success).toBe(false);
  });

  it('binds provenance, platform, source, scenario and evidence into an exact receipt', () => {
    const synthetic = makeSyntheticReceipt({ platform: 'macos', source: 'moodle', scenario: 'a.login' });
    expect(EvidenceReceiptSchema.safeParse(synthetic).success).toBe(true);
    expect(EvidenceReceiptSchema.safeParse({ ...synthetic, evidence: 'L' }).success).toBe(false);
    expect(EvidenceReceiptSchema.safeParse({ ...synthetic, provenance: { kind: 'automated', evidence: 'I', producerId: 'fixture' } }).success).toBe(false);
    expect(EvidenceReceiptSchema.safeParse({ ...synthetic, fullName: 'Private Person' }).success).toBe(false);
  });

  it('keeps Windows live gaps not_run/human_needed and Phase 3 blocked', () => {
    const synthetic = makeSyntheticReceipt({ platform: 'macos', source: 'moodle', scenario: 'a.login' });
    const gate = {
      phase1Status: 'partial', macosFirstException: true, phase2Status: 'blocked', phase3Eligibility: 'blocked',
      cells: [{
        key: { platform: 'windows', source: 'moodle', scenario: 'a.login', evidence: 'L' },
        status: 'not_run', disposition: 'human_needed', latestReceiptId: null,
      }],
    };
    expect(Phase2GateSchema.safeParse(gate).success).toBe(true);
    expect(Phase2GateSchema.safeParse({ ...gate, phase3Eligibility: 'eligible' }).success).toBe(false);
    expect(Phase2GateSchema.safeParse({
      ...gate,
      cells: [{ ...gate.cells[0], key: { ...gate.cells[0]!.key, platform: 'macos' }, status: 'pass', disposition: 'complete', latestReceiptId: synthetic.receiptId }],
      phase3Eligibility: 'eligible',
    }).success).toBe(false);
  });
});
