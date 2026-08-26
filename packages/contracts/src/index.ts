import { z } from 'zod';
import type { BuildIdentity, ComponentObservation, InstallProjection, JobRequest, MaintenanceGate, Observation, SelfcheckProjection, SourceRights, Status } from '../../domain/src/model.js';

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
  auth: z.enum(['not_observed', 'authenticated', 'unauthenticated', 'reauth_required']),
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
export const StatusSchema: z.ZodType<Status> = z.strictObject({
  api: ComponentObservationSchema.nullable(), worker: ComponentObservationSchema.nullable(),
  install: InstallProjectionSchema.nullable(), selfcheck: SelfcheckProjectionSchema.nullable(), checkedAt: timestamp,
}).refine(status => (status.api === null || status.api.role === 'api') && (status.worker === null || status.worker.role === 'worker'), 'Component role mismatch');
