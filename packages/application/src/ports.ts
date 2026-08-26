import type {
  Authorization, BuildIdentity, ComponentObservation, InstallProjection, Job, JobRequest, Lease,
  MaintenanceGate, OutputDestination, OutputOperation, ProcessIdentity, ProcessLaunch,
  Scope, SelfcheckProjection, Status, WriteContext,
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
  read(): Promise<Status>;
  writeComponent(observation: ComponentObservation, context: ProjectionWriteContext): Promise<void>;
  writeInstall(projection: InstallProjection, context: ProjectionWriteContext): Promise<void>;
  writeSelfcheck(projection: SelfcheckProjection, context: ProjectionWriteContext): Promise<void>;
}
