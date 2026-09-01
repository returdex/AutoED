import { describe, expect, it } from 'vitest';
import {
  PHASE2_BUILD_OBLIGATIONS,
  PHASE2_EVIDENCE_REQUIREMENTS,
  evaluatePhase2Evidence,
  evidenceCellKey,
  possibleEvidenceKeys,
  requiredEvidenceKeys,
  validateEvidenceRequirements,
} from '../../packages/domain/src/live-evidence.js';
import {
  EvidenceRequirementSchema,
  PairedLiveResultSchema,
  PendingLiveActionSchema,
} from '../../packages/contracts/src/live-evidence.js';

const ids = {
  action: '11111111-1111-4111-8111-111111111111',
  installation: '22222222-2222-4222-8222-222222222222',
  config: '33333333-3333-4333-8333-333333333333',
  scope: '44444444-4444-4444-8444-444444444444',
  parent: '55555555-5555-4555-8555-555555555555',
};

describe('Phase 2 exact evidence requiredness', () => {
  it('keeps all 176 legacy cells possible but requires exactly the 44 L cells', () => {
    const possible = possibleEvidenceKeys();
    const required = requiredEvidenceKeys();
    expect(possible).toHaveLength(176);
    expect(new Set(possible.map(evidenceCellKey)).size).toBe(176);
    expect(required).toHaveLength(44);
    expect(new Set(required.map(evidenceCellKey)).size).toBe(44);
    expect(required.every(key => key.evidence === 'L')).toBe(true);
    expect(required.filter(key => key.platform === 'macos')).toHaveLength(22);
    expect(required.filter(key => key.platform === 'windows')).toHaveLength(22);
    expect(required.every(key => possible.some(candidate => evidenceCellKey(candidate) === evidenceCellKey(key)))).toBe(true);
  });

  it('maps a closed duplicate-free S/I/N obligation set to every declared requirement', () => {
    const expected = new Map([
      ['AUTH-01', ['auth01.sealed_source_contract']],
      ['AUTH-02', ['auth02.native_lifecycle.macos', 'auth02.native_lifecycle.windows']],
      ['AUTH-03', ['auth03.state_contract', 'auth03.persistence_isolation']],
      ['AUTH-04', ['auth04.ownership_contract', 'auth04.ownership_integration', 'auth04.ownership_native.macos', 'auth04.ownership_native.windows']],
      ['SEC-02', ['sec02.fixed_operations_contract', 'sec02.fixed_operations_integration']],
      ['UAT-01', ['uat01.distribution_contract', 'uat01.native_update.macos', 'uat01.native_update.windows']],
    ] as const);
    expect(validateEvidenceRequirements(PHASE2_EVIDENCE_REQUIREMENTS)).toEqual(PHASE2_EVIDENCE_REQUIREMENTS);
    expect(new Set(PHASE2_BUILD_OBLIGATIONS.map(item => item.id)).size).toBe(PHASE2_BUILD_OBLIGATIONS.length);
    expect(PHASE2_BUILD_OBLIGATIONS.every(item => item.evidence !== 'L' && item.producer === 'signed_automated')).toBe(true);
    for (const [requirement, idsForRequirement] of expected) {
      expect(PHASE2_BUILD_OBLIGATIONS.filter(item => item.requirement === requirement).map(item => item.id)).toEqual(idsForRequirement);
    }
    for (const requirement of PHASE2_EVIDENCE_REQUIREMENTS) {
      expect(EvidenceRequirementSchema.parse(requirement)).toEqual(requirement);
    }
  });

  it('rejects duplicate and contradictory registry keys', () => {
    const first = PHASE2_EVIDENCE_REQUIREMENTS[0]!;
    expect(() => validateEvidenceRequirements([...PHASE2_EVIDENCE_REQUIREMENTS, first])).toThrow('EVIDENCE_REQUIREMENT_DUPLICATE');
    expect(() => validateEvidenceRequirements([
      ...PHASE2_EVIDENCE_REQUIREMENTS,
      { ...first, requirement: first.requirement === 'AUTH-01' ? 'AUTH-02' : 'AUTH-01' },
    ])).toThrow('EVIDENCE_REQUIREMENT_CONTRADICTORY');
  });

  it('does not let a possible-but-nonrequired pass affect final eligibility', () => {
    const nonrequired = possibleEvidenceKeys().find(key => key.evidence === 'S')!;
    const baseline = evaluatePhase2Evidence([], []);
    const withPossiblePass = evaluatePhase2Evidence([nonrequired], []);
    expect(baseline).toEqual({ eligible: false, missingLive: 44, missingBuild: PHASE2_BUILD_OBLIGATIONS.length });
    expect(withPossiblePass).toEqual(baseline);
  });
});

describe('durable live action schemas', () => {
  const pending = {
    actionId: ids.action,
    buildId: 'a'.repeat(64),
    artifactId: 'b'.repeat(64),
    version: '0.1.0-beta.20',
    installationId: ids.installation,
    platform: 'macos',
    source: 'moodle',
    scenario: 'b.codex_exit',
    approvedConfigId: ids.config,
    approvedScopeId: ids.scope,
    bindingFingerprint: 'c'.repeat(64),
    generation: 7,
    parentCheckpointId: ids.parent,
    priorEvidenceEventId: null,
    issuedAt: '2026-09-01T06:00:00.000Z',
    expiresAt: '2026-09-01T07:00:00.000Z',
    state: 'pending',
    consumedAt: null,
  } as const;

  it('binds an action to immutable build, install, platform, source, scenario, scope, binding, generation and parent fields', () => {
    expect(PendingLiveActionSchema.parse(pending)).toEqual(pending);
    expect(PendingLiveActionSchema.safeParse({ ...pending, buildId: undefined }).success).toBe(false);
    expect(PendingLiveActionSchema.safeParse({ ...pending, installationId: undefined }).success).toBe(false);
    expect(PendingLiveActionSchema.safeParse({ ...pending, platform: 'linux' }).success).toBe(false);
    expect(PendingLiveActionSchema.safeParse({ ...pending, source: 'synthetic' }).success).toBe(false);
    expect(PendingLiveActionSchema.safeParse({ ...pending, scenario: 'all' }).success).toBe(false);
    expect(PendingLiveActionSchema.safeParse({ ...pending, generation: -1 }).success).toBe(false);
    expect(PendingLiveActionSchema.safeParse({ ...pending, parentCheckpointId: null }).success).toBe(false);
  });

  it.each([
    'url', 'selector', 'javascript', 'browserHandle', 'credential', 'password', 'mfa', 'profilePath', 'cookie',
    'storageState', 'rawHtml', 'dom', 'request', 'response', 'headers', 'body', 'authority', 'authorityToken',
  ])('rejects forbidden pending-action field %s', field => {
    expect(PendingLiveActionSchema.safeParse({ ...pending, [field]: 'forbidden' }).success).toBe(false);
  });

  it('accepts only a bounded result and never caller-supplied L authority or cell selection', () => {
    const result = {
      actionId: ids.action,
      status: 'pass',
      resultCode: 'CHECKPOINT_CONFIRMED',
      bindingConsistency: 'consistent',
      gaps: [],
      checkedAt: '2026-09-01T06:30:00.000Z',
      correctionOfEventId: null,
    } as const;
    expect(PairedLiveResultSchema.parse(result)).toEqual(result);
    for (const field of ['authority', 'authorityToken', 'evidence', 'platform', 'source', 'scenario', 'buildId', 'generation', 'profilePath', 'cookie']) {
      expect(PairedLiveResultSchema.safeParse({ ...result, [field]: 'caller-selected' }).success).toBe(false);
    }
  });
});
