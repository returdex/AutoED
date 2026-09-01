import { z } from 'zod';
import type {
  AccountBinding, ApprovedSourceConfig, BuildIdentity, ComponentObservation, EvidenceCell, EvidenceReceipt,
  IdentityEvidence, InstallProjection, JobRequest, MaintenanceGate, Observation, Phase2Gate, ProfileOwnerIdentity,
  ProfileOwnership, ProfileReservation, ProtectedSourceIdentity, SelfcheckProjection, SourceObservation,
  SourceProbeRequest, SourceProbeResult, SourceRights, Status,
} from '../../domain/src/model.js';

const timestamp = z.iso.datetime().nullable();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
function sameBuild(a: BuildIdentity, b: BuildIdentity): boolean {
  return a.version === b.version && a.buildId === b.buildId && a.commit === b.commit && a.tree === b.tree &&
    a.dependencyHash === b.dependencyHash && a.protocol === b.protocol && a.schemaMin === b.schemaMin && a.schemaMax === b.schemaMax &&
    [...new Set(a.capabilities)].sort().join(',') === [...new Set(b.capabilities)].sort().join(',');
}
export const ScopeSchema = z.strictObject({ installationId: z.uuid(), source: z.literal('synthetic'), courseId: z.literal('selftest') });
export const JobRequestSchema: z.ZodType<JobRequest> = z.strictObject({ kind: z.enum(['echo', 'digest']), value: z.string().max(4096), idempotencyKey: z.uuid(), scope: ScopeSchema });
export const BuildIdentitySchema: z.ZodType<BuildIdentity> = z.strictObject({
  version: z.string().regex(/^0\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/), buildId: hash, commit: revision, tree: revision, dependencyHash: hash,
  protocol: z.literal(1), schemaMin: z.literal(1), schemaMax: z.literal(1), capabilities: z.array(z.enum(['echo', 'digest'])).min(1).max(2),
});
const health = z.enum(['not_observed', 'healthy', 'degraded', 'error']);
const projectionFreshness = z.enum(['not_observed', 'fresh', 'stale']).optional();
export const ObservationSchema: z.ZodType<Observation> = z.strictObject({
  auth: z.enum(['not_observed', 'authenticated', 'unauthenticated', 'reauth_required', 'identity_mismatch']),
  capability: z.enum(['unknown', 'available', 'unavailable', 'denied']), health,
  freshness: z.enum(['not_observed', 'fresh', 'stale']), completeness: z.enum(['not_observed', 'complete', 'partial']),
  outcome: z.enum(['partial', 'empty', 'error', 'not_observed', 'deleted', 'present']), checkedAt: timestamp,
});
const right = z.enum(['allowed', 'restricted', 'unknown']);
export const SourceRightsSchema: z.ZodType<SourceRights> = z.strictObject({ access: right, retain: right, disclose: right, basis: z.string().min(1).max(256) });
export const OutputOperationSchema = z.enum(['status', 'job_read', 'selftest']);
export const OutputDestinationSchema = z.enum(['local_ui', 'local_cli', 'model']);
export const MaintenanceGateSchema: z.ZodType<MaintenanceGate> = z.strictObject({
  operationId: z.uuid().nullable(), generation: z.number().int().nonnegative(), state: z.enum(['open', 'quiescing', 'exclusive']),
  owner: z.string().min(1).max(128).nullable(), leaseUntil: z.number().int().nonnegative().nullable(),
}).refine(gate => gate.state === 'open' ? gate.operationId === null && gate.owner === null && gate.leaseUntil === null : gate.operationId !== null && gate.owner !== null && gate.leaseUntil !== null, 'Maintenance ownership required');
export const ComponentObservationSchema: z.ZodType<ComponentObservation> = z.strictObject({
  freshness: projectionFreshness,
  role: z.enum(['api', 'worker', 'cli', 'mcp']), build: BuildIdentitySchema.nullable(), checkedAt: timestamp, health,
  evidence: z.enum(['not_observed', 'authenticated_probe', 'process_report']),
}).refine(item => item.evidence === 'not_observed'
  ? item.health === 'not_observed' && item.build === null && item.checkedAt === null
  : item.checkedAt !== null && (item.health !== 'healthy' || item.build !== null), 'Observation must have actual evidence');
export const InstallProjectionSchema: z.ZodType<InstallProjection> = z.strictObject({
  previousInstallation: z.enum(['none','present','unknown']).optional(),
  freshness: projectionFreshness,
  operationId: z.uuid(), stage: z.enum(['preview', 'download', 'verify', 'stage', 'quiesce', 'backup', 'migrate', 'activate', 'selfcheck', 'cleanup', 'complete', 'rollback', 'stopped']),
  result: z.enum(['not_observed', 'running', 'succeeded', 'failed', 'restored', 'human_needed']),
  targetBuild: BuildIdentitySchema.nullable(), actualBuild: BuildIdentitySchema.nullable(),
  cleanup: z.enum(['not_observed', 'pending', 'complete', 'cleanup_pending']), checkedAt: timestamp,
}).refine(item => item.result !== 'succeeded' || (item.checkedAt !== null && item.stage === 'complete' && item.cleanup === 'complete' && item.targetBuild !== null && item.actualBuild !== null && sameBuild(item.targetBuild, item.actualBuild)), 'Successful installation requires actual matching build, observation time and completed cleanup');
export const SelfcheckProjectionSchema: z.ZodType<SelfcheckProjection> = z.strictObject({
  freshness: projectionFreshness,
  jobId: z.uuid().nullable(), probes: z.array(ComponentObservationSchema).max(4), featureResult: z.enum(['not_observed', 'pass', 'fail']), checkedAt: timestamp,
}).refine(item => {
  if (item.featureResult !== 'pass') return true;
  const first = item.probes[0]?.build;
  return item.jobId !== null && item.checkedAt !== null && item.probes.length === 4 && new Set(item.probes.map(probe => probe.role)).size === 4 && first != null &&
    item.probes.every(probe => probe.health === 'healthy' && probe.build !== null && sameBuild(first, probe.build) && probe.checkedAt !== null && Date.parse(probe.checkedAt) <= Date.parse(item.checkedAt!));
}, 'Passing selfcheck requires a job and four consistent actual component observations');
export const ManifestObservationSchema=z.strictObject({build:BuildIdentitySchema,manifestHash:hash,checkedAt:z.iso.datetime(),evidence:z.enum(['build_manifest','verified_release_manifest']),freshness:projectionFreshness});
export const StatusSchema: z.ZodType<Status> = z.strictObject({
  manifest:ManifestObservationSchema.nullable().optional(),
  installationId: z.uuid().optional(),
  api: ComponentObservationSchema.nullable(), worker: ComponentObservationSchema.nullable(),
  install: InstallProjectionSchema.nullable(), selfcheck: SelfcheckProjectionSchema.nullable(), checkedAt: timestamp,
}).refine(status => (status.api === null || status.api.role === 'api') && (status.worker === null || status.worker.role === 'worker'), 'Component role mismatch');

const sourceId = z.enum(['moodle', 'edstem']);
const sourceAction = z.enum([
  'moodle.auth_probe', 'edstem.auth_probe', 'moodle.course_visibility_probe', 'edstem.course_visibility_probe',
]);
const sourceResultCode = z.enum([
  'NOT_OBSERVED', 'AUTHENTICATED', 'AUTH_REQUIRED', 'REAUTH_REQUIRED', 'NETWORK_UNAVAILABLE', 'PARSER_CHANGED',
  'CAPABILITY_DENIED', 'IDENTITY_MISMATCH',
]);
const boundedFingerprint = z.string().min(8).max(128).regex(/^[a-z0-9_-]+$/i);

export const SourceProbeRequestSchema: z.ZodType<SourceProbeRequest> = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('moodle'),
    action: z.enum(['moodle.auth_probe', 'moodle.course_visibility_probe']),
    approvedConfigId: z.uuid(), approvedScopeId: z.uuid(),
  }),
  z.strictObject({
    source: z.literal('edstem'),
    action: z.enum(['edstem.auth_probe', 'edstem.course_visibility_probe']),
    approvedConfigId: z.uuid(), approvedScopeId: z.uuid(),
  }),
]);

export const ApprovedSourceConfigSchema: z.ZodType<ApprovedSourceConfig> = z.strictObject({
  id: z.uuid(), source: sourceId, officialOrigin: z.string().min(1).max(2048), approvedScopeId: z.uuid(), confirmedAt: z.iso.datetime(),
}).superRefine((config, context) => {
  let parsed: URL;
  try { parsed = new URL(config.officialOrigin); }
  catch { context.addIssue({ code: 'custom', message: 'Official origin must be an absolute URL' }); return; }
  const host = parsed.hostname.toLowerCase();
  const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':');
  const normalized = parsed.origin === config.officialOrigin;
  const sourceMatches = config.source === 'moodle'
    ? host.split('.').some(part => part.includes('moodle'))
    : host === 'edstem.org' || host.endsWith('.edstem.org');
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '' || !normalized || isIp || host === 'localhost' || host.endsWith('.localhost') || !sourceMatches) {
    context.addIssue({ code: 'custom', message: 'Origin must be normalized HTTPS, official and source-matched' });
  }
});

export const ProtectedSourceIdentitySchema: z.ZodType<ProtectedSourceIdentity> = z.strictObject({
  classification: z.literal('protected_local'), source: sourceId,
  stableSubjectId: z.string().min(1).max(256), organizationId: z.string().min(1).max(256), tenantId: z.string().min(1).max(256).nullable(),
  displayName: z.string().min(1).max(256), schoolEmail: z.email().max(320),
});

export const IdentityEvidenceSchema: z.ZodType<IdentityEvidence> = z.strictObject({
  source: sourceId, subjectFingerprint: boundedFingerprint, organizationFingerprint: boundedFingerprint,
  tenantFingerprint: boundedFingerprint.nullable(), approvedScopeId: z.uuid(), evidenceKind: z.literal('stable_subject_organization_scope'),
});

export const SourceObservationSchema: z.ZodType<SourceObservation> = z.strictObject({
  source: sourceId,
  auth: z.enum(['not_observed', 'authenticated', 'unauthenticated', 'reauth_required', 'identity_mismatch']),
  capability: z.enum(['unknown', 'available', 'unavailable', 'denied']), health,
  freshness: z.enum(['not_observed', 'fresh', 'stale']), completeness: z.enum(['not_observed', 'complete', 'partial']),
  outcome: z.enum(['partial', 'empty', 'error', 'not_observed', 'deleted', 'present']), checkedAt: timestamp,
  resultCode: sourceResultCode, courseAccess: z.enum(['allowed', 'blocked']),
  lastSuccess: z.strictObject({ checkedAt: z.iso.datetime(), subjectFingerprint: boundedFingerprint }).nullable(),
}).refine(value => value.auth !== 'identity_mismatch' || value.courseAccess === 'blocked' && value.resultCode === 'IDENTITY_MISMATCH', {
  message: 'Identity mismatch must block course access',
});

export const AccountBindingSchema: z.ZodType<AccountBinding> = z.strictObject({
  status: z.enum(['unbound', 'candidate', 'confirmed', 'identity_mismatch']),
  moodle: IdentityEvidenceSchema.nullable(), edstem: IdentityEvidenceSchema.nullable(),
  basis: z.enum(['none', 'stable_subject_organization_scope', 'human_confirmed', 'identity_changed']),
  confirmedByActionReceiptId: z.uuid().nullable(), courseAccess: z.enum(['allowed', 'blocked']), checkedAt: timestamp,
}).superRefine((binding, context) => {
  const pair = binding.moodle?.source === 'moodle' && binding.edstem?.source === 'edstem';
  const consistentScope = pair && binding.moodle!.approvedScopeId === binding.edstem!.approvedScopeId;
  const valid = binding.status === 'unbound'
    ? binding.moodle === null && binding.edstem === null && binding.basis === 'none' && binding.confirmedByActionReceiptId === null && binding.courseAccess === 'blocked'
    : binding.status === 'candidate'
      ? consistentScope && binding.basis === 'stable_subject_organization_scope' && binding.confirmedByActionReceiptId === null && binding.courseAccess === 'blocked'
      : binding.status === 'confirmed'
        ? consistentScope && binding.basis === 'human_confirmed' && binding.confirmedByActionReceiptId !== null && binding.courseAccess === 'allowed'
        : pair && binding.basis === 'identity_changed' && binding.confirmedByActionReceiptId === null && binding.courseAccess === 'blocked';
  if (!valid) context.addIssue({ code: 'custom', message: 'Binding state, evidence and course access are inconsistent' });
});

export const SourceProbeResultSchema: z.ZodType<SourceProbeResult> = z.strictObject({
  request: SourceProbeRequestSchema, observation: SourceObservationSchema, identity: IdentityEvidenceSchema.nullable(),
  selectedCourseVisible: z.boolean().nullable(),
}).superRefine((result, context) => {
  if (result.request.source !== result.observation.source || result.identity !== null && result.identity.source !== result.request.source) {
    context.addIssue({ code: 'custom', message: 'Probe result source mismatch' });
  }
  if (result.request.action.endsWith('.auth_probe') && result.selectedCourseVisible !== null) {
    context.addIssue({ code: 'custom', message: 'Auth probes cannot report course visibility' });
  }
});

export const ProfileReservationSchema: z.ZodType<ProfileReservation> = z.strictObject({
  installationId: z.uuid(), browserBuildId: hash, nonce: z.uuid(), generation: z.number().int().nonnegative(),
  fence: z.number().int().nonnegative(), reservedAt: z.iso.datetime(),
});
export const ProfileOwnerIdentitySchema: z.ZodType<ProfileOwnerIdentity> = z.strictObject({
  installationId: z.uuid(), browserBuildId: hash, nonce: z.uuid(), generation: z.number().int().nonnegative(),
  fence: z.number().int().nonnegative(), reservedAt: z.iso.datetime(), pid: z.number().int().positive(),
  osStartIdentity: z.string().min(1).max(256), executable: z.string().min(1).max(2048), startedAt: z.iso.datetime(),
});

export const ProfileOwnershipSchema: z.ZodType<ProfileOwnership> = z.strictObject({
  state: z.enum(['available', 'reserved', 'owned', 'in_use', 'unconfirmed', 'confirmed_exited']),
  disposition: z.enum(['proceed', 'human_needed', 'cleanup_allowed']),
  resultCode: z.enum(['PROFILE_AVAILABLE', 'PROFILE_RESERVED', 'PROFILE_OWNED', 'PROFILE_IN_USE', 'PROFILE_OWNERSHIP_UNCONFIRMED', 'PROFILE_CONFIRMED_EXITED']),
  reservation: ProfileReservationSchema.nullable(), owner: ProfileOwnerIdentitySchema.nullable(), leaseUntil: z.number().int().nonnegative().nullable(),
}).superRefine((ownership, context) => {
  const pairMatches = ownership.reservation !== null && ownership.owner !== null &&
    ownership.reservation.installationId === ownership.owner.installationId && ownership.reservation.browserBuildId === ownership.owner.browserBuildId &&
    ownership.reservation.nonce === ownership.owner.nonce && ownership.reservation.generation === ownership.owner.generation && ownership.reservation.fence === ownership.owner.fence;
  const valid = ownership.state === 'available'
    ? ownership.disposition === 'proceed' && ownership.resultCode === 'PROFILE_AVAILABLE' && ownership.reservation === null && ownership.owner === null && ownership.leaseUntil === null
    : ownership.state === 'reserved'
      ? ownership.disposition === 'proceed' && ownership.resultCode === 'PROFILE_RESERVED' && ownership.reservation !== null && ownership.owner === null && ownership.leaseUntil !== null
      : ownership.state === 'owned'
        ? ownership.disposition === 'proceed' && ownership.resultCode === 'PROFILE_OWNED' && pairMatches && ownership.leaseUntil !== null
        : ownership.state === 'in_use'
          ? ownership.disposition === 'human_needed' && ownership.resultCode === 'PROFILE_IN_USE' && pairMatches
          : ownership.state === 'unconfirmed'
            ? ownership.disposition === 'human_needed' && ownership.resultCode === 'PROFILE_OWNERSHIP_UNCONFIRMED' && ownership.reservation !== null
            : ownership.disposition === 'cleanup_allowed' && ownership.resultCode === 'PROFILE_CONFIRMED_EXITED' && pairMatches;
  if (!valid) context.addIssue({ code: 'custom', message: 'Profile ownership proof and disposition are inconsistent' });
});

const nativePlatform = z.enum(['macos', 'windows']);
const uatScenario = z.enum([
  'a.login', 'a.binding', 'a.course_visibility', 'b.reopen_1', 'b.reopen_2', 'b.reopen_3', 'b.worker_restart', 'b.codex_exit',
  'c.os_restart', 'd.24h_recheck', 'reauth',
]);
const evidenceStatus = z.enum(['pass', 'fail', 'not_run', 'human_needed']);
const receiptBase = {
  receiptId: z.uuid(), buildId: hash, version: z.string().regex(/^0\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/),
  platform: nativePlatform, source: sourceId, scenario: uatScenario, status: evidenceStatus,
  resultCode: z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/),
  bindingConsistency: z.enum(['consistent', 'mismatch', 'not_observed']), gaps: z.array(z.string().min(1).max(128)).max(32), checkedAt: z.iso.datetime(),
} as const;
const automatedReceipt = <E extends 'S' | 'I' | 'N'>(evidence: E) => z.strictObject({
  ...receiptBase, evidence: z.literal(evidence),
  provenance: z.strictObject({ kind: z.literal('automated'), evidence: z.literal(evidence), producerId: z.string().min(1).max(128) }),
});

export const EvidenceReceiptSchema: z.ZodType<EvidenceReceipt> = z.union([
  automatedReceipt('S'), automatedReceipt('I'), automatedReceipt('N'),
  z.strictObject({
    ...receiptBase, evidence: z.literal('L'),
    provenance: z.strictObject({ kind: z.literal('human_action'), actionReceiptId: z.uuid() }),
  }),
]);
export const SyntheticEvidenceReceiptSchema = automatedReceipt('S');

export const EvidenceCellKeySchema = z.strictObject({ platform: nativePlatform, source: sourceId, scenario: uatScenario, evidence: z.enum(['S', 'I', 'N', 'L']) });
export const EvidenceCellSchema: z.ZodType<EvidenceCell> = z.strictObject({
  key: EvidenceCellKeySchema, status: evidenceStatus, disposition: z.enum(['complete', 'blocked', 'human_needed']), latestReceiptId: z.uuid().nullable(),
}).refine(cell => cell.status === 'pass'
  ? cell.disposition === 'complete' && cell.latestReceiptId !== null
  : cell.status === 'fail'
    ? cell.disposition === 'blocked' && cell.latestReceiptId !== null
    : cell.disposition === 'human_needed' && cell.latestReceiptId === null, 'Evidence cell state is inconsistent');

const evidenceClasses = ['S', 'I', 'N', 'L'] as const;
const platforms = ['macos', 'windows'] as const;
const sources = ['moodle', 'edstem'] as const;
const scenarios = [
  'a.login', 'a.binding', 'a.course_visibility', 'b.reopen_1', 'b.reopen_2', 'b.reopen_3', 'b.worker_restart', 'b.codex_exit',
  'c.os_restart', 'd.24h_recheck', 'reauth',
] as const;
const requiredEvidenceCells = new Set(platforms.flatMap(platform => sources.flatMap(source => scenarios.flatMap(scenario =>
  evidenceClasses.map(evidence => `${platform}|${source}|${scenario}|${evidence}`)))));

export const Phase2GateSchema: z.ZodType<Phase2Gate> = z.strictObject({
  phase1Status: z.literal('partial'), macosFirstException: z.literal(true), phase2Status: z.enum(['blocked', 'eligible']),
  phase3Eligibility: z.enum(['blocked', 'eligible']), cells: z.array(EvidenceCellSchema).max(requiredEvidenceCells.size),
}).superRefine((gate, context) => {
  const keys = gate.cells.map(cell => `${cell.key.platform}|${cell.key.source}|${cell.key.scenario}|${cell.key.evidence}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', message: 'Evidence cells must have unique exact keys' });
  const complete = keys.length === requiredEvidenceCells.size && keys.every(key => requiredEvidenceCells.has(key)) &&
    gate.cells.every(cell => cell.status === 'pass' && cell.disposition === 'complete' && cell.latestReceiptId !== null);
  if ((gate.phase2Status === 'eligible' || gate.phase3Eligibility === 'eligible') && !complete) {
    context.addIssue({ code: 'custom', message: 'Phase eligibility requires the complete dual-platform evidence matrix' });
  }
  if (gate.phase2Status !== gate.phase3Eligibility) context.addIssue({ code: 'custom', message: 'Phase 3 cannot advance before Phase 2 eligibility' });
});
