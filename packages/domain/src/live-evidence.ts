import type { EvidenceCellKey, EvidenceClass, NativePlatform, SourceId, UatScenario } from './model.js';

export const PHASE2_REQUIREMENTS = ['AUTH-01', 'AUTH-02', 'AUTH-03', 'AUTH-04', 'SEC-02', 'UAT-01'] as const;
export type Phase2Requirement = typeof PHASE2_REQUIREMENTS[number];
export type EvidenceRequirementScenario = UatScenario | 'security_matrix' | 'native_preflight' | 'distribution';

export interface EvidenceRequirement {
  requirement: Phase2Requirement;
  platform: NativePlatform | 'cross-platform';
  source: SourceId | 'both' | 'none';
  scenario: EvidenceRequirementScenario;
  evidence: EvidenceClass;
  producer: 'signed_automated' | 'paired_human_action';
}

export interface NamedBuildObligation extends EvidenceRequirement {
  id:
    | 'auth01.sealed_source_contract'
    | 'auth02.native_lifecycle.macos'
    | 'auth02.native_lifecycle.windows'
    | 'auth03.state_contract'
    | 'auth03.persistence_isolation'
    | 'auth04.ownership_contract'
    | 'auth04.ownership_integration'
    | 'auth04.ownership_native.macos'
    | 'auth04.ownership_native.windows'
    | 'sec02.fixed_operations_contract'
    | 'sec02.fixed_operations_integration'
    | 'uat01.distribution_contract'
    | 'uat01.native_update.macos'
    | 'uat01.native_update.windows';
}

const PLATFORMS = ['macos', 'windows'] as const;
const SOURCES = ['moodle', 'edstem'] as const;
const EVIDENCE_CLASSES = ['S', 'I', 'N', 'L'] as const;
export const LIVE_SCENARIOS = [
  'a.login',
  'a.binding',
  'a.course_visibility',
  'b.reopen_1',
  'b.reopen_2',
  'b.reopen_3',
  'b.worker_restart',
  'b.codex_exit',
  'c.os_restart',
  'd.24h_recheck',
  'reauth',
] as const satisfies readonly UatScenario[];

const LIVE_REQUIREMENT_BY_SCENARIO: Readonly<Record<UatScenario, Phase2Requirement>> = Object.freeze({
  'a.login': 'AUTH-01',
  'a.binding': 'AUTH-03',
  'a.course_visibility': 'SEC-02',
  'b.reopen_1': 'AUTH-02',
  'b.reopen_2': 'AUTH-02',
  'b.reopen_3': 'AUTH-02',
  'b.worker_restart': 'AUTH-02',
  'b.codex_exit': 'UAT-01',
  'c.os_restart': 'AUTH-02',
  'd.24h_recheck': 'AUTH-03',
  reauth: 'AUTH-03',
});

const BUILD_OBLIGATIONS: readonly NamedBuildObligation[] = [
  { id: 'auth01.sealed_source_contract', requirement: 'AUTH-01', platform: 'cross-platform', source: 'both', scenario: 'security_matrix', evidence: 'S', producer: 'signed_automated' },
  { id: 'auth02.native_lifecycle.macos', requirement: 'AUTH-02', platform: 'macos', source: 'both', scenario: 'native_preflight', evidence: 'N', producer: 'signed_automated' },
  { id: 'auth02.native_lifecycle.windows', requirement: 'AUTH-02', platform: 'windows', source: 'both', scenario: 'native_preflight', evidence: 'N', producer: 'signed_automated' },
  { id: 'auth03.state_contract', requirement: 'AUTH-03', platform: 'cross-platform', source: 'both', scenario: 'security_matrix', evidence: 'S', producer: 'signed_automated' },
  { id: 'auth03.persistence_isolation', requirement: 'AUTH-03', platform: 'cross-platform', source: 'both', scenario: 'security_matrix', evidence: 'I', producer: 'signed_automated' },
  { id: 'auth04.ownership_contract', requirement: 'AUTH-04', platform: 'cross-platform', source: 'none', scenario: 'security_matrix', evidence: 'S', producer: 'signed_automated' },
  { id: 'auth04.ownership_integration', requirement: 'AUTH-04', platform: 'cross-platform', source: 'none', scenario: 'security_matrix', evidence: 'I', producer: 'signed_automated' },
  { id: 'auth04.ownership_native.macos', requirement: 'AUTH-04', platform: 'macos', source: 'none', scenario: 'native_preflight', evidence: 'N', producer: 'signed_automated' },
  { id: 'auth04.ownership_native.windows', requirement: 'AUTH-04', platform: 'windows', source: 'none', scenario: 'native_preflight', evidence: 'N', producer: 'signed_automated' },
  { id: 'sec02.fixed_operations_contract', requirement: 'SEC-02', platform: 'cross-platform', source: 'both', scenario: 'security_matrix', evidence: 'S', producer: 'signed_automated' },
  { id: 'sec02.fixed_operations_integration', requirement: 'SEC-02', platform: 'cross-platform', source: 'both', scenario: 'security_matrix', evidence: 'I', producer: 'signed_automated' },
  { id: 'uat01.distribution_contract', requirement: 'UAT-01', platform: 'cross-platform', source: 'none', scenario: 'distribution', evidence: 'S', producer: 'signed_automated' },
  { id: 'uat01.native_update.macos', requirement: 'UAT-01', platform: 'macos', source: 'none', scenario: 'distribution', evidence: 'N', producer: 'signed_automated' },
  { id: 'uat01.native_update.windows', requirement: 'UAT-01', platform: 'windows', source: 'none', scenario: 'distribution', evidence: 'N', producer: 'signed_automated' },
];

export const PHASE2_BUILD_OBLIGATIONS = Object.freeze(BUILD_OBLIGATIONS.map(item => Object.freeze({ ...item })));

const LIVE_REQUIREMENTS: readonly EvidenceRequirement[] = PLATFORMS.flatMap(platform =>
  SOURCES.flatMap(source => LIVE_SCENARIOS.map(scenario => Object.freeze({
    requirement: LIVE_REQUIREMENT_BY_SCENARIO[scenario],
    platform,
    source,
    scenario,
    evidence: 'L' as const,
    producer: 'paired_human_action' as const,
  }))),
);

/** Complete production registry: 44 live cells plus named, build-bound S/I/N obligations. */
export const PHASE2_EVIDENCE_REQUIREMENTS: readonly EvidenceRequirement[] = Object.freeze([
  ...LIVE_REQUIREMENTS,
  ...PHASE2_BUILD_OBLIGATIONS.map(({ id: _id, ...requirement }) => Object.freeze(requirement)),
]);

const isLiveScenario = (value: EvidenceRequirementScenario): value is UatScenario =>
  (LIVE_SCENARIOS as readonly string[]).includes(value);

const requirementKey = (item: EvidenceRequirement): string =>
  [item.requirement, item.platform, item.source, item.scenario, item.evidence, item.producer].join('|');
const liveCellRequirementKey = (item: EvidenceRequirement): string =>
  [item.platform, item.source, item.scenario, item.evidence].join('|');

export function validateEvidenceRequirements<T extends readonly EvidenceRequirement[]>(requirements: T): T {
  const exact = new Set<string>();
  const liveCells = new Map<string, EvidenceRequirement>();
  for (const item of requirements) {
    const key = requirementKey(item);
    if (exact.has(key)) throw new Error('EVIDENCE_REQUIREMENT_DUPLICATE');
    exact.add(key);
    if (isLiveScenario(item.scenario) && item.platform !== 'cross-platform' && item.source !== 'both' && item.source !== 'none') {
      const cell = liveCellRequirementKey(item);
      const prior = liveCells.get(cell);
      if (prior && requirementKey(prior) !== key) throw new Error('EVIDENCE_REQUIREMENT_CONTRADICTORY');
      liveCells.set(cell, item);
    }
  }
  return requirements;
}

validateEvidenceRequirements(PHASE2_EVIDENCE_REQUIREMENTS);

export function evidenceCellKey(key: EvidenceCellKey): string {
  return [key.platform, key.source, key.scenario, key.evidence].join('|');
}

export function possibleEvidenceKeys(): EvidenceCellKey[] {
  return PLATFORMS.flatMap(platform => SOURCES.flatMap(source => LIVE_SCENARIOS.flatMap(scenario =>
    EVIDENCE_CLASSES.map(evidence => ({ platform, source, scenario, evidence })),
  )));
}

export function requiredEvidenceKeys(): EvidenceCellKey[] {
  return LIVE_REQUIREMENTS.map(requirement => ({
    platform: requirement.platform as NativePlatform,
    source: requirement.source as SourceId,
    scenario: requirement.scenario as UatScenario,
    evidence: 'L',
  }));
}

export function evaluatePhase2Evidence(
  passedCells: Iterable<EvidenceCellKey>,
  passedBuildObligations: Iterable<NamedBuildObligation['id']>,
): { eligible: boolean; missingLive: number; missingBuild: number } {
  const required = new Set(requiredEvidenceKeys().map(evidenceCellKey));
  const passedRequired = new Set([...passedCells].map(evidenceCellKey).filter(key => required.has(key)));
  const passedBuild = new Set(passedBuildObligations);
  const missingLive = required.size - passedRequired.size;
  const missingBuild = PHASE2_BUILD_OBLIGATIONS.filter(item => !passedBuild.has(item.id)).length;
  return { eligible: missingLive === 0 && missingBuild === 0, missingLive, missingBuild };
}

export interface LiveCheckpointBinding {
  buildId: string;
  artifactId: string;
  version: string;
  installationId: string;
  platform: NativePlatform;
  source: SourceId;
  scenario: UatScenario;
  approvedConfigId: string;
  approvedScopeId: string;
  bindingFingerprint: string;
  generation: number;
  parentCheckpointId: string;
  priorEvidenceEventId: string | null;
}

export interface PendingLiveActionIssue extends LiveCheckpointBinding { ttlMs: number }

export interface PendingLiveAction extends LiveCheckpointBinding {
  actionId: string;
  issuedAt: string;
  expiresAt: string;
  state: 'pending' | 'consumed' | 'expired';
  consumedAt: string | null;
}

export interface PairedLiveResult {
  actionId: string;
  status: 'pass' | 'fail';
  resultCode: string;
  bindingConsistency: 'consistent' | 'mismatch' | 'not_observed';
  gaps: string[];
  checkedAt: string;
  correctionOfEventId: string | null;
}

export interface LiveActionFailure {
  actionId: string;
  failureId: string;
  code: string;
  checkedAt: string;
}
