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
  auth: 'not_observed' | 'authenticated' | 'unauthenticated' | 'reauth_required' | 'identity_mismatch';
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
  /** Missing is unknown; only inventory evidence may establish no previous install. */
  previousInstallation?: 'none' | 'present' | 'unknown' | undefined;
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
  manifest?: ManifestObservation | null | undefined;
  installationId?: string | undefined;
  api: ComponentObservation | null; worker: ComponentObservation | null;
  install: InstallProjection | null; selfcheck: SelfcheckProjection | null; checkedAt: string | null;
}
export interface ManifestObservation {
  build:BuildIdentity; manifestHash:string; checkedAt:string;
  evidence:'build_manifest'|'verified_release_manifest';
  freshness?:'not_observed'|'fresh'|'stale'|undefined;
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

export type SourceId = 'moodle' | 'edstem';
export type SourceAction =
  | 'moodle.auth_probe'
  | 'edstem.auth_probe'
  | 'moodle.course_visibility_probe'
  | 'edstem.course_visibility_probe';

export interface SourceProbeRequest {
  source: SourceId;
  action: SourceAction;
  approvedConfigId: string;
  approvedScopeId: string;
}

export type SourceResultCode =
  | 'NOT_OBSERVED'
  | 'AUTHENTICATED'
  | 'AUTH_REQUIRED'
  | 'REAUTH_REQUIRED'
  | 'NETWORK_UNAVAILABLE'
  | 'PARSER_CHANGED'
  | 'CAPABILITY_DENIED'
  | 'IDENTITY_MISMATCH';

export interface SourceLastSuccess {
  checkedAt: string;
  subjectFingerprint: string;
}

export interface SourceObservation extends Observation {
  source: SourceId;
  resultCode: SourceResultCode;
  courseAccess: 'allowed' | 'blocked';
  lastSuccess: SourceLastSuccess | null;
}

export interface ApprovedSourceConfig {
  id: string;
  source: SourceId;
  officialOrigin: string;
  approvedScopeId: string;
  confirmedAt: string;
}

/** Protected-local identity projection. It must never enter receipts, gates or model-facing output. */
export interface ProtectedSourceIdentity {
  classification: 'protected_local';
  source: SourceId;
  stableSubjectId: string;
  organizationId: string;
  tenantId: string | null;
  displayName: string;
  schoolEmail: string;
}

export interface IdentityEvidence {
  source: SourceId;
  subjectFingerprint: string;
  organizationFingerprint: string;
  tenantFingerprint: string | null;
  approvedScopeId: string;
  evidenceKind: 'stable_subject_organization_scope';
}

export interface AccountBinding {
  status: 'unbound' | 'candidate' | 'confirmed' | 'identity_mismatch';
  moodle: IdentityEvidence | null;
  edstem: IdentityEvidence | null;
  basis: 'none' | 'stable_subject_organization_scope' | 'human_confirmed' | 'identity_changed';
  confirmedByActionReceiptId: string | null;
  courseAccess: 'allowed' | 'blocked';
  checkedAt: string | null;
}

export interface SourceProbeResult {
  request: SourceProbeRequest;
  observation: SourceObservation;
  identity: IdentityEvidence | null;
  selectedCourseVisible: boolean | null;
}

export interface ProfileReservation {
  installationId: string;
  browserBuildId: string;
  nonce: string;
  generation: number;
  fence: number;
  reservedAt: string;
}

export interface ProfileOwnerIdentity extends ProfileReservation {
  pid: number;
  osStartIdentity: string;
  executable: string;
  startedAt: string;
}

export type ProfileOwnershipState = 'available' | 'reserved' | 'owned' | 'in_use' | 'unconfirmed' | 'confirmed_exited';
export interface ProfileOwnership {
  state: ProfileOwnershipState;
  disposition: 'proceed' | 'human_needed' | 'cleanup_allowed';
  resultCode: 'PROFILE_AVAILABLE' | 'PROFILE_RESERVED' | 'PROFILE_OWNED' | 'PROFILE_IN_USE' | 'PROFILE_OWNERSHIP_UNCONFIRMED' | 'PROFILE_CONFIRMED_EXITED';
  reservation: ProfileReservation | null;
  owner: ProfileOwnerIdentity | null;
  leaseUntil: number | null;
}

export type EvidenceClass = 'S' | 'I' | 'N' | 'L';
export type NativePlatform = 'macos' | 'windows';
export type UatScenario =
  | 'a.login'
  | 'a.binding'
  | 'a.course_visibility'
  | 'b.reopen_1'
  | 'b.reopen_2'
  | 'b.reopen_3'
  | 'b.worker_restart'
  | 'b.codex_exit'
  | 'c.os_restart'
  | 'd.24h_recheck'
  | 'reauth';

export type AutomatedEvidenceProvenance = {
  kind: 'automated'; evidence: 'S' | 'I' | 'N'; producerId: string;
};
export type LiveEvidenceProvenance = {
  kind: 'human_action'; actionReceiptId: string;
};
export type EvidenceProvenance = AutomatedEvidenceProvenance | LiveEvidenceProvenance;

export interface EvidenceReceipt {
  receiptId: string;
  buildId: string;
  version: string;
  platform: NativePlatform;
  source: SourceId;
  scenario: UatScenario;
  evidence: EvidenceClass;
  status: 'pass' | 'fail' | 'not_run' | 'human_needed';
  resultCode: string;
  bindingConsistency: 'consistent' | 'mismatch' | 'not_observed';
  gaps: string[];
  checkedAt: string;
  provenance: EvidenceProvenance;
}

export interface EvidenceCellKey {
  platform: NativePlatform;
  source: SourceId;
  scenario: UatScenario;
  evidence: EvidenceClass;
}

export interface EvidenceCell {
  key: EvidenceCellKey;
  status: 'pass' | 'fail' | 'not_run' | 'human_needed';
  disposition: 'complete' | 'blocked' | 'human_needed';
  latestReceiptId: string | null;
}

export interface Phase2Gate {
  phase1Status: 'partial';
  macosFirstException: true;
  phase2Status: 'blocked' | 'eligible';
  phase3Eligibility: 'blocked' | 'eligible';
  cells: EvidenceCell[];
}

declare global { const __AUTOED_BUILD_IDENTITY__: Readonly<BuildIdentity>; }
