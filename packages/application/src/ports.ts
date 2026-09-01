import type {
  AccountBinding, ApprovedSourceConfig, Authorization, BuildIdentity, ComponentObservation, EvidenceCellKey,
  EvidenceReceipt, InstallProjection, Job, JobRequest, Lease, MaintenanceGate, NativePlatform, OutputDestination,
  OutputOperation, ProcessIdentity, ProcessLaunch, ProfileOwnerIdentity, ProfileOwnership, ProfileReservation, Scope,
  SelfcheckProjection, SourceId, SourceObservation, SourceProbeRequest, SourceProbeResult, Status, WriteContext,
} from '../../domain/src/model.js';

export interface Clock { now(): number }
export interface JobStore {
  enqueue(request: JobRequest, context: WriteContext): Promise<Job>;
  claim(input: { owner: string; now: number; leaseMs: number }, context: WriteContext): Promise<Job | null>;
  heartbeat(jobId: string, lease: Lease, now: number, context: WriteContext): Promise<Lease>;
  commit(jobId: string, lease: Lease, result: string, now: number, context: WriteContext): Promise<Job>;
  checkpoint(jobId: string, lease: Lease, checkpoint: string, now: number, context: WriteContext): Promise<void>;
  fail(jobId: string, lease: Lease, errorCode: string, retryable: boolean, now: number, context: WriteContext): Promise<Job>;
  requestCancel(jobId: string, scope: Scope, context: WriteContext): Promise<Job>;
  acknowledgeCancel(jobId: string, lease: Lease, now: number, context: WriteContext): Promise<Job>;
  recoverExpired(now: number, context: WriteContext): Promise<number>;
  query(jobId: string, scope: Scope): Promise<Job | null>;
}
export interface MaintenanceStore {
  read(): Promise<MaintenanceGate>;
  enterMaintenance(input: { operationId: string; owner: string; leaseUntil: number; expectedGeneration: number }): Promise<MaintenanceGate>;
  markExclusive(operationId: string, expectedGeneration: number): Promise<MaintenanceGate>;
  exitMaintenance(operationId: string, expectedGeneration: number): Promise<MaintenanceGate>;
}
export interface OutputPolicy {
  /** Resolve source rights and authenticated current scope internally; fail closed. */
  authorize(scope: Scope, operation: OutputOperation, destination: OutputDestination): Promise<Authorization>;
}
export interface SecretStore {
  /** Values stay in the caller process; never log or include in model output. */
  get(installationId: string, name: string): Promise<string | null>;
  set(installationId: string, name: string, value: string): Promise<void>;
  delete(installationId: string, name: string): Promise<void>;
}
export interface ProcessSupervisor {
  start(launch: ProcessLaunch): Promise<ProcessIdentity>;
  stop(identity: ProcessIdentity): Promise<void>;
  inspect(identity: ProcessIdentity): Promise<'running' | 'exited' | 'identity_mismatch' | 'unknown'>;
}
export interface IdentityProbe {
  /** Obtain actual component observations; expected manifest is not evidence. */
  collect(expected: BuildIdentity): Promise<ComponentObservation[]>;
}
export interface ProjectionWriteContext { expectedGeneration: number; operationId: string | null }
export interface StatusProjectionStore {
  writeManifest(value:import('../../domain/src/model.js').ManifestObservation,context:ProjectionWriteContext):Promise<void>;
  read(): Promise<Status>;
  writeComponent(observation: ComponentObservation, context: ProjectionWriteContext): Promise<void>;
  writeInstall(projection: InstallProjection, context: ProjectionWriteContext): Promise<void>;
  writeSelfcheck(projection: SelfcheckProjection, context: ProjectionWriteContext): Promise<void>;
}

/** A sealed source adapter accepts only a request that already passed the strict runtime contract. */
export interface SourceProbePort {
  probe(request: SourceProbeRequest, signal: AbortSignal): Promise<SourceProbeResult>;
}

/** Only the dedicated confirmation flow writes approved source configuration. */
export interface SourceConfigStore {
  read(source: SourceId): Promise<ApprovedSourceConfig | null>;
  confirm(config: ApprovedSourceConfig, context: WriteContext): Promise<void>;
}

/** Each source owns an independent observation and last-success record. */
export interface SourceObservationStore {
  read(source: SourceId): Promise<SourceObservation | null>;
  write(observation: SourceObservation, context: WriteContext): Promise<void>;
}

export interface AccountBindingStore {
  read(): Promise<AccountBinding>;
  write(binding: AccountBinding, context: WriteContext): Promise<void>;
}

export interface ProfileOwnershipStore {
  read(): Promise<ProfileOwnership>;
  acquire(reservation: ProfileReservation, context: WriteContext): Promise<ProfileOwnership>;
  renew(owner: ProfileOwnerIdentity, leaseUntil: number, context: WriteContext): Promise<ProfileOwnership>;
  markConfirmedExited(owner: ProfileOwnerIdentity, context: WriteContext): Promise<ProfileOwnership>;
  release(owner: ProfileOwnerIdentity, context: WriteContext): Promise<void>;
}

export type EvidenceWriterAuthority =
  | { kind: 'automated'; evidence: 'S' | 'I' | 'N'; platform: NativePlatform; producerId: string }
  | { kind: 'human_action'; evidence: 'L'; platform: NativePlatform; actionReceiptId: string };

/** Implementations must match authority evidence and platform to the complete receipt key before append. */
export interface EvidenceLedger {
  append(receipt: EvidenceReceipt, authority: EvidenceWriterAuthority, context: WriteContext): Promise<void>;
  list(key: EvidenceCellKey, expectedGeneration?: number): Promise<EvidenceReceipt[]>;
}

/**
 * Reservation checks the current holder first. A running holder returns PROFILE_IN_USE/human_needed;
 * unknown or mismatched ownership returns PROFILE_OWNERSHIP_UNCONFIRMED/human_needed. Fencing or lease
 * expiry never proves exit. Release requires the same installation, nonce, OS start identity and exact
 * executable; stale state is cleanable only after inspect returns confirmed_exited.
 */
export interface ProfileOwnershipCoordinator {
  reserve(input: { installationId: string; browserBuildId: string; generation: number; fence: number }): Promise<ProfileOwnership>;
  attach(
    reservation: ProfileReservation,
    process: { pid: number; osStartIdentity: string; executable: string; startedAt: string },
  ): Promise<ProfileOwnership>;
  inspect(owner: ProfileOwnerIdentity): Promise<ProfileOwnership>;
  release(owner: ProfileOwnerIdentity): Promise<void>;
}
