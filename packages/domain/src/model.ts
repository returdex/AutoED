/** Pure domain contracts: no driver, transport, filesystem or browser imports. */
export const JOB_STATES = ['queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled'] as const;
export type JobState = typeof JOB_STATES[number];
export interface Scope { installationId: string; source: 'synthetic'; courseId: 'selftest' }
export interface JobRequest { kind: 'echo' | 'digest'; value: string; idempotencyKey: string; scope: Scope }
export interface BuildIdentity {
  version: string; buildId: string; commit: string; tree: string; dependencyHash: string;
  protocol: 1; schemaMin: 1; schemaMax: 1; capabilities: string[];
}
export type Health = 'not_observed' | 'healthy' | 'degraded' | 'error';
export interface Observation {
  auth: 'not_observed' | 'authenticated' | 'unauthenticated' | 'reauth_required';
  capability: 'unknown' | 'available' | 'unavailable' | 'denied';
  health: Health;
  freshness: 'not_observed' | 'fresh' | 'stale';
  completeness: 'not_observed' | 'complete' | 'partial';
  outcome: 'partial' | 'empty' | 'error' | 'not_observed' | 'deleted' | 'present';
  checkedAt: string | null;
}
export type Right = 'allowed' | 'restricted' | 'unknown';
export interface SourceRights { access: Right; retain: Right; disclose: Right; basis: string }
export type OutputOperation = 'status' | 'job_read' | 'selftest';
export type OutputDestination = 'local_ui' | 'local_cli' | 'model';
export interface Authorization {
  allowed: boolean; reason: 'allowed' | 'scope_denied' | 'rights_unknown' | 'rights_restricted' | 'destination_denied';
}
export interface MaintenanceGate {
  operationId: string | null; generation: number; state: 'open' | 'quiescing' | 'exclusive';
  owner: string | null; leaseUntil: number | null;
}
/** Supplied by the authenticated application, never parsed from a normal job body. */
export interface WriteContext {
  expectedGeneration: number;
  selfcheck?: { operationId: string; generation: number };
}
export interface Lease { owner: string; fence: number; leaseUntil: number }
export interface Job {
  id: string; request: JobRequest; state: JobState; cancelRequested: boolean;
  attempt: number; maxAttempts: number; nextRunAt: number | null; lease: Lease | null;
  checkpoint: string | null; result: string | null; lastSuccessResult: string | null;
  errorCode: string | null; generation: number; operationId: string | null;
  createdAt: number; updatedAt: number;
}
export type ComponentRole = 'api' | 'worker' | 'cli' | 'mcp';
export interface ComponentObservation {
  freshness?: 'not_observed' | 'fresh' | 'stale' | undefined;
  role: ComponentRole; build: BuildIdentity | null; checkedAt: string | null; health: Health;
  evidence: 'not_observed' | 'authenticated_probe' | 'process_report';
}
export interface InstallProjection {
  freshness?: 'not_observed' | 'fresh' | 'stale' | undefined;
  operationId: string;
  stage: 'preview' | 'download' | 'verify' | 'stage' | 'quiesce' | 'backup' | 'migrate' | 'activate' | 'selfcheck' | 'cleanup' | 'complete' | 'rollback' | 'stopped';
  result: 'not_observed' | 'running' | 'succeeded' | 'failed' | 'restored' | 'human_needed';
  targetBuild: BuildIdentity | null; actualBuild: BuildIdentity | null;
  cleanup: 'not_observed' | 'pending' | 'complete' | 'cleanup_pending'; checkedAt: string | null;
}
export interface SelfcheckProjection {
  freshness?: 'not_observed' | 'fresh' | 'stale' | undefined;
  jobId: string | null; probes: ComponentObservation[];
  featureResult: 'not_observed' | 'pass' | 'fail'; checkedAt: string | null;
}
export interface Status {
  api: ComponentObservation | null; worker: ComponentObservation | null;
  install: InstallProjection | null; selfcheck: SelfcheckProjection | null; checkedAt: string | null;
}
export interface ProcessIdentity {
  installationId: string; role: 'api' | 'worker'; buildId: string;
  pid: number; nonce: string; osStartIdentity: string;
  /** Required by the runtime supervisor; optional only for older contract callers. */
  executable?: string | undefined;
}
export interface ProcessLaunch {
  installationId: string; role: 'api' | 'worker'; build: BuildIdentity;
}

declare global { const __AUTOED_BUILD_IDENTITY__: Readonly<BuildIdentity>; }
