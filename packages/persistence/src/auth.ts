import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import { z, ZodError } from 'zod';
import type {
  AccountBindingStore, Clock, EvidenceLedger, EvidenceWriterAuthority, ProfileOwnershipStore, SourceConfigStore, SourceObservationStore,
} from '../../application/src/ports.js';
import type {
  AuthJob, AuthJobLease, AuthJobResultCode, AuthJobStore, AuthProbeCommand,
} from '../../application/src/auth-jobs.js';
import { AUTH_RECOVERY_DELAYS_MS, type AuthTransition } from '../../application/src/auth.js';
import type {
  AccountBinding, ApprovedSourceConfig, EvidenceCellKey, EvidenceReceipt, ProfileOwnerIdentity, ProfileOwnership, ProfileReservation,
  SourceId, SourceLastSuccess, SourceObservation, WriteContext,
} from '../../domain/src/model.js';
import {
  AccountBindingSchema, ApprovedSourceConfigSchema, EvidenceCellKeySchema, EvidenceReceiptSchema, ProfileOwnerIdentitySchema,
  ProfileOwnershipSchema, ProfileReservationSchema, SourceObservationSchema,
} from '../../contracts/src/index.js';
import { recordWrite, requireWrite, StorageError } from './database.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const proof = (nonce: string) => digest(`profile-control-proof\0${nonce}`);
const sameDigest = (left: string, right: string) => timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
const source = (value: SourceId): SourceId => {
  if (value !== 'moodle' && value !== 'edstem') throw new StorageError('INVALID_SOURCE');
  return value;
};
function observedAt(value: string | null, now: number, staleCode: string): number {
  if (value === null) throw new StorageError(staleCode);
  const parsed = Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new StorageError(staleCode);
  if (parsed > now) throw new StorageError('FUTURE_OBSERVATION');
  return parsed;
}
function safeStorage<T>(operation: () => T): T {
  try { return operation(); }
  catch (error) {
    if (error instanceof StorageError || error instanceof ZodError) throw error;
    const code = (error as { code?: unknown }).code;
    if (code === 'SQLITE_BUSY' || code === 'SQLITE_FULL') throw new StorageError(code);
    if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) throw new StorageError('STORAGE_CONSTRAINT');
    throw new StorageError('STORAGE_FAILURE', 503);
  }
}

interface ConfigRow {
  id: string; source: SourceId; official_origin: string; approved_scope_id: string; confirmed_at: number; config_version: number;
}
interface ObservationRow { current_contract: string; last_success_contract: string | null; checked_at: number | null }
interface BindingRow {
  status: AccountBinding['status']; moodle_subject_fingerprint: string; moodle_organization_fingerprint: string;
  moodle_tenant_fingerprint: string | null; moodle_scope_id: string; edstem_subject_fingerprint: string;
  edstem_organization_fingerprint: string; edstem_tenant_fingerprint: string | null; edstem_scope_id: string;
  basis: AccountBinding['basis']; confirmed_action_receipt_id: string | null; course_access: AccountBinding['courseAccess']; checked_at: number;
}
interface OwnershipRow {
  installation_id: string | null; browser_build_id: string | null; pid: number | null; nonce_hash: string | null;
  control_proof_fingerprint: string | null; os_start_identity: string | null; managed_executable_identity: string | null;
  reserved_at: number | null; started_at: number | null; lease_until: number | null; generation: number; fence: number;
  state: Exclude<ProfileOwnership['state'], 'available'> | 'available';
}
interface EvidenceRow {
  receipt_id: string; build_id: string; version: string; platform: EvidenceReceipt['platform']; source: EvidenceReceipt['source'];
  scenario: EvidenceReceipt['scenario']; evidence: EvidenceReceipt['evidence']; status: EvidenceReceipt['status']; result_code: string;
  binding_consistency: EvidenceReceipt['bindingConsistency']; gap_codes: string; observed_at: number;
  producer_kind: EvidenceReceipt['provenance']['kind']; producer_id: string;
}

export class SQLiteSourceConfigStore implements SourceConfigStore {
  constructor(private readonly db: Database.Database, private readonly clock: Clock = { now: () => Date.now() }) {}
  async read(value: SourceId): Promise<ApprovedSourceConfig | null> {
    const row = this.db.prepare('SELECT id,source,official_origin,approved_scope_id,confirmed_at,config_version FROM source_configs WHERE source=? ORDER BY config_version DESC LIMIT 1').get(source(value)) as ConfigRow | undefined;
    return row ? ApprovedSourceConfigSchema.parse({ id: row.id, source: row.source, officialOrigin: row.official_origin, approvedScopeId: row.approved_scope_id, confirmedAt: new Date(row.confirmed_at).toISOString() }) : null;
  }
  async confirm(input: ApprovedSourceConfig, context: WriteContext): Promise<void> {
    const value = ApprovedSourceConfigSchema.parse(input); const confirmedAt = observedAt(value.confirmedAt, this.clock.now(), 'INVALID_CONFIRMATION_TIME');
    safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context);
      const prior = this.db.prepare('SELECT id,official_origin,approved_scope_id,confirmed_at,config_version FROM source_configs WHERE source=? ORDER BY config_version DESC LIMIT 1').get(value.source) as Omit<ConfigRow, 'source'> | undefined;
      if (prior && confirmedAt <= prior.confirmed_at) throw new StorageError('STALE_SOURCE_CONFIG');
      this.db.prepare('INSERT INTO source_configs(id,source,official_origin,approved_scope_id,confirmed_at,config_version,generation) VALUES(?,?,?,?,?,?,?)')
        .run(value.id, value.source, value.officialOrigin, value.approvedScopeId, confirmedAt, (prior?.config_version ?? 0) + 1, context.expectedGeneration);
      recordWrite(this.db, context);
    }).immediate());
  }
}

export class SQLiteSourceObservationStore implements SourceObservationStore {
  constructor(private readonly db: Database.Database, private readonly clock: Clock = { now: () => Date.now() }) {}
  async read(value: SourceId): Promise<SourceObservation | null> {
    const row = this.db.prepare('SELECT current_contract,last_success_contract,checked_at FROM source_observations WHERE source=?').get(source(value)) as ObservationRow | undefined;
    if (!row) return null;
    const current = SourceObservationSchema.parse(JSON.parse(row.current_contract));
    return SourceObservationSchema.parse({ ...current, lastSuccess: row.last_success_contract === null ? null : JSON.parse(row.last_success_contract) });
  }
  async write(input: SourceObservation, context: WriteContext): Promise<void> {
    const value = SourceObservationSchema.parse(input); const checkedAt = observedAt(value.checkedAt, this.clock.now(), 'INVALID_OBSERVATION_TIME');
    safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context);
      const prior = this.db.prepare('SELECT current_contract,last_success_contract,checked_at FROM source_observations WHERE source=?').get(value.source) as ObservationRow | undefined;
      if (prior?.checked_at !== null && prior?.checked_at !== undefined && checkedAt <= prior.checked_at) throw new StorageError('STALE_OBSERVATION');
      const successful = value.resultCode === 'AUTHENTICATED' && value.auth === 'authenticated' && value.health === 'healthy' && value.outcome === 'present';
      if (successful && (value.lastSuccess === null || Date.parse(value.lastSuccess.checkedAt) !== checkedAt)) throw new StorageError('INVALID_SUCCESS_OBSERVATION');
      const lastSuccess = successful ? value.lastSuccess : prior?.last_success_contract === null || prior === undefined ? null : JSON.parse(prior.last_success_contract);
      const current = SourceObservationSchema.parse({ ...value, lastSuccess });
      this.db.prepare(`INSERT INTO source_observations(source,current_contract,last_success_contract,checked_at,generation) VALUES(?,?,?,?,?)
        ON CONFLICT(source) DO UPDATE SET current_contract=excluded.current_contract,last_success_contract=excluded.last_success_contract,checked_at=excluded.checked_at,generation=excluded.generation`)
        .run(value.source, JSON.stringify(current), lastSuccess === null ? null : JSON.stringify(lastSuccess), checkedAt, context.expectedGeneration);
      recordWrite(this.db, context);
    }).immediate());
  }
}

export class SQLiteAccountBindingStore implements AccountBindingStore {
  constructor(private readonly db: Database.Database, private readonly clock: Clock = { now: () => Date.now() }) {}
  async read(): Promise<AccountBinding> {
    const row = this.db.prepare('SELECT * FROM account_bindings ORDER BY checked_at DESC,rowid DESC LIMIT 1').get() as BindingRow | undefined;
    if (!row) return AccountBindingSchema.parse({ status: 'unbound', moodle: null, edstem: null, basis: 'none', confirmedByActionReceiptId: null, courseAccess: 'blocked', checkedAt: null });
    return this.toBinding(row);
  }
  async write(input: AccountBinding, context: WriteContext): Promise<void> {
    const value = AccountBindingSchema.parse(input);
    if (value.status === 'unbound' || value.moodle === null || value.edstem === null) throw new StorageError('INVALID_BINDING_TRANSITION');
    const moodle = value.moodle; const edstem = value.edstem;
    const checkedAt = observedAt(value.checkedAt, this.clock.now(), 'INVALID_BINDING_TIME');
    safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context);
      const prior = this.db.prepare('SELECT * FROM account_bindings ORDER BY checked_at DESC,rowid DESC LIMIT 1').get() as BindingRow | undefined;
      if (prior && checkedAt <= prior.checked_at) throw new StorageError('STALE_BINDING');
      if (value.status === 'confirmed' && (!prior || prior.status !== 'candidate' || this.differs(value, this.toBinding(prior)))) {
        throw new StorageError('BINDING_CONFIRMATION_INVALID');
      }
      if (value.status === 'identity_mismatch') {
        const confirmed = this.db.prepare("SELECT * FROM account_bindings WHERE status='confirmed' ORDER BY checked_at DESC,rowid DESC LIMIT 1").get() as BindingRow | undefined;
        if (!confirmed || !this.differs(value, this.toBinding(confirmed))) throw new StorageError('IDENTITY_MISMATCH_UNPROVEN');
      }
      this.db.prepare(`INSERT INTO account_bindings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        randomUUID(), value.status, moodle.subjectFingerprint, moodle.organizationFingerprint, moodle.tenantFingerprint,
        moodle.approvedScopeId, edstem.subjectFingerprint, edstem.organizationFingerprint, edstem.tenantFingerprint,
        edstem.approvedScopeId, value.basis, value.confirmedByActionReceiptId, value.courseAccess, checkedAt, context.expectedGeneration,
      );
      recordWrite(this.db, context);
    }).immediate());
  }
  private toBinding(row: BindingRow): AccountBinding {
    return AccountBindingSchema.parse({
      status: row.status,
      moodle: { source: 'moodle', subjectFingerprint: row.moodle_subject_fingerprint, organizationFingerprint: row.moodle_organization_fingerprint, tenantFingerprint: row.moodle_tenant_fingerprint, approvedScopeId: row.moodle_scope_id, evidenceKind: 'stable_subject_organization_scope' },
      edstem: { source: 'edstem', subjectFingerprint: row.edstem_subject_fingerprint, organizationFingerprint: row.edstem_organization_fingerprint, tenantFingerprint: row.edstem_tenant_fingerprint, approvedScopeId: row.edstem_scope_id, evidenceKind: 'stable_subject_organization_scope' },
      basis: row.basis, confirmedByActionReceiptId: row.confirmed_action_receipt_id, courseAccess: row.course_access, checkedAt: new Date(row.checked_at).toISOString(),
    });
  }
  private differs(value: AccountBinding, prior: AccountBinding): boolean {
    return JSON.stringify([value.moodle, value.edstem]) !== JSON.stringify([prior.moodle, prior.edstem]);
  }
}

export class SQLiteProfileOwnershipStore implements ProfileOwnershipStore {
  constructor(private readonly db: Database.Database, private readonly clock: Clock = { now: () => Date.now() }) {}
  async read(): Promise<ProfileOwnership> {
    const row = this.row(); return row ? this.fromRow(row) : this.available();
  }
  async acquire(input: ProfileReservation, context: WriteContext): Promise<ProfileOwnership> {
    const value = ProfileReservationSchema.parse(input); const reservedAt = observedAt(value.reservedAt, this.clock.now(), 'INVALID_RESERVATION_TIME');
    return safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context);
      const prior = this.row();
      if (prior && prior.state !== 'available') throw new StorageError(prior.state === 'unconfirmed' ? 'PROFILE_OWNERSHIP_UNCONFIRMED' : 'PROFILE_IN_USE');
      const fence = Math.max(prior?.fence ?? 0, value.fence) + 1; const leaseUntil = this.clock.now() + 60_000;
      if (!Number.isSafeInteger(leaseUntil)) throw new StorageError('INVALID_PROFILE_LEASE');
      this.db.prepare(`INSERT INTO profile_ownership(id,installation_id,browser_build_id,pid,nonce_hash,control_proof_fingerprint,os_start_identity,managed_executable_identity,reserved_at,started_at,lease_until,generation,fence,state)
        VALUES(1,?,?,NULL,?,?,NULL,NULL,?,NULL,?,?,?,'reserved')
        ON CONFLICT(id) DO UPDATE SET installation_id=excluded.installation_id,browser_build_id=excluded.browser_build_id,pid=NULL,nonce_hash=excluded.nonce_hash,
          control_proof_fingerprint=excluded.control_proof_fingerprint,os_start_identity=NULL,managed_executable_identity=NULL,reserved_at=excluded.reserved_at,
          started_at=NULL,lease_until=excluded.lease_until,generation=excluded.generation,fence=excluded.fence,state='reserved'`)
        .run(value.installationId, value.browserBuildId, digest(value.nonce), proof(value.nonce), reservedAt, leaseUntil, context.expectedGeneration, fence);
      recordWrite(this.db, context);
      return ProfileOwnershipSchema.parse({ state: 'reserved', disposition: 'proceed', resultCode: 'PROFILE_RESERVED', reservation: { ...value, fence }, owner: null, leaseUntil });
    }).immediate());
  }
  async renew(input: ProfileOwnerIdentity, leaseUntil: number, context: WriteContext): Promise<ProfileOwnership> {
    const owner = ProfileOwnerIdentitySchema.parse(input);
    if (!Number.isSafeInteger(leaseUntil) || leaseUntil <= this.clock.now()) throw new StorageError('INVALID_PROFILE_LEASE');
    return safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context); const row = this.requiredRow();
      this.assertBase(row, owner);
      if (row.state !== 'reserved') this.assertOwner(row, owner);
      if (row.state === 'confirmed_exited' || row.state === 'available') throw new StorageError('PROFILE_FENCE_MISMATCH');
      if (row.lease_until !== null && leaseUntil <= row.lease_until) throw new StorageError('STALE_PROFILE_LEASE');
      this.db.prepare("UPDATE profile_ownership SET pid=?,os_start_identity=?,managed_executable_identity=?,started_at=?,lease_until=?,state='owned' WHERE id=1")
        .run(owner.pid, owner.osStartIdentity, digest(owner.executable), Date.parse(owner.startedAt), leaseUntil);
      recordWrite(this.db, context);
      return ProfileOwnershipSchema.parse({ state: 'owned', disposition: 'proceed', resultCode: 'PROFILE_OWNED', reservation: this.reservation(owner), owner, leaseUntil });
    }).immediate());
  }
  async markConfirmedExited(input: ProfileOwnerIdentity, context: WriteContext): Promise<ProfileOwnership> {
    const owner = ProfileOwnerIdentitySchema.parse(input);
    return safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context); const row = this.requiredRow(); this.assertOwner(row, owner);
      if (!['owned', 'in_use', 'unconfirmed'].includes(row.state)) throw new StorageError('PROFILE_FENCE_MISMATCH');
      this.db.prepare("UPDATE profile_ownership SET state='confirmed_exited' WHERE id=1").run(); recordWrite(this.db, context);
      return ProfileOwnershipSchema.parse({ state: 'confirmed_exited', disposition: 'cleanup_allowed', resultCode: 'PROFILE_CONFIRMED_EXITED', reservation: this.reservation(owner), owner, leaseUntil: row.lease_until });
    }).immediate());
  }
  async release(input: ProfileOwnerIdentity, context: WriteContext): Promise<void> {
    const owner = ProfileOwnerIdentitySchema.parse(input);
    safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context); const row = this.requiredRow(); this.assertOwner(row, owner);
      if (row.state !== 'confirmed_exited') throw new StorageError('PROFILE_EXIT_UNCONFIRMED');
      this.db.prepare(`UPDATE profile_ownership SET installation_id=NULL,browser_build_id=NULL,pid=NULL,nonce_hash=NULL,control_proof_fingerprint=NULL,
        os_start_identity=NULL,managed_executable_identity=NULL,reserved_at=NULL,started_at=NULL,lease_until=NULL,state='available' WHERE id=1`).run();
      recordWrite(this.db, context);
    }).immediate());
  }
  private row(): OwnershipRow | undefined { return this.db.prepare('SELECT * FROM profile_ownership WHERE id=1').get() as OwnershipRow | undefined; }
  private requiredRow(): OwnershipRow { const row = this.row(); if (!row) throw new StorageError('PROFILE_FENCE_MISMATCH'); return row; }
  private available(): ProfileOwnership { return { state: 'available', disposition: 'proceed', resultCode: 'PROFILE_AVAILABLE', reservation: null, owner: null, leaseUntil: null }; }
  private reservation(owner: ProfileOwnerIdentity): ProfileReservation {
    const { installationId, browserBuildId, nonce, generation, fence, reservedAt } = owner;
    return { installationId, browserBuildId, nonce, generation, fence, reservedAt };
  }
  private assertBase(row: OwnershipRow, owner: ProfileOwnerIdentity): void {
    if (row.installation_id !== owner.installationId || row.browser_build_id !== owner.browserBuildId || row.nonce_hash === null || row.control_proof_fingerprint === null ||
      !sameDigest(row.nonce_hash, digest(owner.nonce)) || !sameDigest(row.control_proof_fingerprint, proof(owner.nonce)) || row.reserved_at !== Date.parse(owner.reservedAt) ||
      row.generation !== owner.generation || row.fence !== owner.fence) throw new StorageError('PROFILE_FENCE_MISMATCH');
  }
  private assertOwner(row: OwnershipRow, owner: ProfileOwnerIdentity): void {
    this.assertBase(row, owner);
    if (row.pid !== owner.pid || row.os_start_identity !== owner.osStartIdentity || row.managed_executable_identity === null ||
      !sameDigest(row.managed_executable_identity, digest(owner.executable)) || row.started_at !== Date.parse(owner.startedAt)) throw new StorageError('PROFILE_OWNERSHIP_MISMATCH');
  }
  private fromRow(row: OwnershipRow): ProfileOwnership {
    if (row.state === 'available') return this.available();
    if (row.installation_id === null || row.browser_build_id === null || row.nonce_hash === null || row.reserved_at === null || row.lease_until === null) throw new StorageError('STORAGE_FAILURE', 503);
    const reservation: ProfileReservation = {
      installationId: row.installation_id, browserBuildId: row.browser_build_id, nonce: this.maskedUuid(row.nonce_hash), generation: row.generation,
      fence: row.fence, reservedAt: new Date(row.reserved_at).toISOString(),
    };
    const owner: ProfileOwnerIdentity | null = row.pid === null || row.os_start_identity === null || row.managed_executable_identity === null || row.started_at === null
      ? null : { ...reservation, pid: row.pid, osStartIdentity: row.os_start_identity, executable: `managed:${row.managed_executable_identity}`, startedAt: new Date(row.started_at).toISOString() };
    const disposition = row.state === 'confirmed_exited' ? 'cleanup_allowed' : row.state === 'in_use' || row.state === 'unconfirmed' ? 'human_needed' : 'proceed';
    const resultCode = row.state === 'reserved' ? 'PROFILE_RESERVED' : row.state === 'owned' ? 'PROFILE_OWNED' : row.state === 'in_use' ? 'PROFILE_IN_USE' : row.state === 'unconfirmed' ? 'PROFILE_OWNERSHIP_UNCONFIRMED' : 'PROFILE_CONFIRMED_EXITED';
    return ProfileOwnershipSchema.parse({ state: row.state, disposition, resultCode, reservation, owner, leaseUntil: row.lease_until });
  }
  private maskedUuid(hash: string): string {
    const value = hash.slice(0, 32).split(''); value[12] = '4'; value[16] = '8'; const compact = value.join('');
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  }
}

export class SQLiteEvidenceLedger implements EvidenceLedger {
  constructor(private readonly db: Database.Database, private readonly clock: Clock = { now: () => Date.now() }) {}
  async append(input: EvidenceReceipt, authority: EvidenceWriterAuthority, context: WriteContext): Promise<void> {
    const receipt = EvidenceReceiptSchema.parse(input);
    this.assertAuthority(receipt, authority);
    const observed = observedAt(receipt.checkedAt, this.clock.now(), 'INVALID_EVIDENCE_TIME');
    if (receipt.gaps.some(code => !/^[A-Z0-9_]+$/.test(code))) throw new StorageError('INVALID_EVIDENCE_GAP_CODE');
    const canonical = JSON.stringify({ receipt, authority });
    const idempotencyHash = digest(canonical);
    safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context);
      const duplicate = this.db.prepare('SELECT idempotency_hash FROM uat_receipts WHERE receipt_id=?').get(receipt.receiptId) as { idempotency_hash: string } | undefined;
      if (duplicate) {
        if (!sameDigest(duplicate.idempotency_hash, idempotencyHash)) throw new StorageError('EVIDENCE_IDEMPOTENCY_CONFLICT');
        return;
      }
      const prior = this.db.prepare(`SELECT event_id,recorded_at FROM uat_receipts
        WHERE platform=? AND source=? AND scenario=? AND evidence=? ORDER BY recorded_at DESC,event_id DESC LIMIT 1`)
        .get(receipt.platform, receipt.source, receipt.scenario, receipt.evidence) as { event_id: string; recorded_at: number } | undefined;
      const recordedAt = Math.max(this.clock.now(), (prior?.recorded_at ?? -1) + 1);
      if (!Number.isSafeInteger(recordedAt) || recordedAt < 0) throw new StorageError('INVALID_EVIDENCE_TIME');
      const producerId = receipt.provenance.kind === 'automated' ? receipt.provenance.producerId : receipt.provenance.actionReceiptId;
      this.db.prepare(`INSERT INTO uat_receipts(event_id,receipt_id,idempotency_hash,prior_event_id,schema_version,build_id,artifact_id,version,
        platform,source,scenario,evidence,status,result_code,binding_consistency,gap_codes,observed_at,recorded_at,generation,producer_kind,producer_id)
        VALUES(?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        randomUUID(), receipt.receiptId, idempotencyHash, prior?.event_id ?? null, receipt.buildId, receipt.buildId, receipt.version,
        receipt.platform, receipt.source, receipt.scenario, receipt.evidence, receipt.status, receipt.resultCode, receipt.bindingConsistency,
        JSON.stringify(receipt.gaps), observed, recordedAt, context.expectedGeneration, receipt.provenance.kind, producerId,
      );
      recordWrite(this.db, context);
    }).immediate());
  }
  async list(input: EvidenceCellKey): Promise<EvidenceReceipt[]> {
    const key = EvidenceCellKeySchema.parse(input);
    return safeStorage(() => {
      const rows = this.db.prepare(`SELECT receipt_id,build_id,version,platform,source,scenario,evidence,status,result_code,binding_consistency,
        gap_codes,observed_at,producer_kind,producer_id FROM uat_receipts
        WHERE platform=? AND source=? AND scenario=? AND evidence=? ORDER BY recorded_at,event_id`)
        .all(key.platform, key.source, key.scenario, key.evidence) as EvidenceRow[];
      return rows.map(row => EvidenceReceiptSchema.parse({
        receiptId: row.receipt_id, buildId: row.build_id, version: row.version, platform: row.platform, source: row.source,
        scenario: row.scenario, evidence: row.evidence, status: row.status, resultCode: row.result_code,
        bindingConsistency: row.binding_consistency, gaps: JSON.parse(row.gap_codes), checkedAt: new Date(row.observed_at).toISOString(),
        provenance: row.producer_kind === 'automated'
          ? { kind: 'automated', evidence: row.evidence, producerId: row.producer_id }
          : { kind: 'human_action', actionReceiptId: row.producer_id },
      }));
    });
  }
  private assertAuthority(receipt: EvidenceReceipt, authority: EvidenceWriterAuthority): void {
    const actualPlatform = process.platform === 'win32' ? 'windows' : 'macos';
    const expectedKeys = authority.kind === 'automated'
      ? ['evidence', 'kind', 'platform', 'producerId']
      : ['actionReceiptId', 'evidence', 'kind', 'platform'];
    if (Object.keys(authority).sort().join(',') !== expectedKeys.join(',')) throw new StorageError('EVIDENCE_AUTHORITY_MISMATCH');
    if (receipt.platform !== actualPlatform || authority.platform !== actualPlatform || receipt.platform !== authority.platform || receipt.evidence !== authority.evidence) {
      throw new StorageError('EVIDENCE_AUTHORITY_MISMATCH');
    }
    if (authority.kind === 'automated') {
      if (receipt.provenance.kind !== 'automated' || receipt.provenance.evidence !== authority.evidence ||
        receipt.provenance.producerId !== authority.producerId || !/^[A-Za-z0-9._-]+$/.test(authority.producerId) ||
        (authority.evidence === 'N' && authority.producerId !== `native.${authority.platform}`)) {
        throw new StorageError('EVIDENCE_AUTHORITY_MISMATCH');
      }
      return;
    }
    if (receipt.provenance.kind !== 'human_action' || receipt.provenance.actionReceiptId !== authority.actionReceiptId) {
      throw new StorageError('EVIDENCE_AUTHORITY_MISMATCH');
    }
  }
}

const authCommandSchema: z.ZodType<AuthProbeCommand> = z.strictObject({
  source: z.enum(['moodle', 'edstem']),
  approvedConfigId: z.uuid(),
  approvedScopeId: z.uuid(),
  trigger: z.enum(['background', 'user_login_completed', 'manual_retry']),
  idempotencyKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
});
const authLeaseSchema: z.ZodType<AuthJobLease> = z.strictObject({
  owner: z.string().min(1).max(128),
  fence: z.number().int().nonnegative(),
  generation: z.number().int().nonnegative(),
  leaseUntil: z.iso.datetime(),
});
const sourceLastSuccessSchema: z.ZodType<SourceLastSuccess> = z.strictObject({
  checkedAt: z.iso.datetime(),
  subjectFingerprint: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

interface AuthClock { now(): string }
interface AuthJobRow {
  id: string;
  source: SourceId;
  action: AuthJob['action'];
  trigger: AuthJob['trigger'];
  idempotency_key: string;
  command_hash: string;
  approved_config_id: string;
  approved_scope_id: string;
  state: AuthJob['state'];
  attempt: number;
  recovery_started_at: number | null;
  next_run_at: number | null;
  cancel_requested: number;
  lease_owner: string | null;
  lease_until: number | null;
  lease_ms: number | null;
  fence: number;
  generation: number;
  safe_result_code: AuthJobResultCode | null;
  last_success_checked_at: number | null;
  last_success_fingerprint: string | null;
  parent_job_id: string | null;
  effect_kind: 'moodle_reauth_follow_up' | null;
  created_at: number;
  updated_at: number;
}

function authTime(value: string): number {
  const parsed = Date.parse(z.iso.datetime().parse(value));
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new StorageError('INVALID_CLOCK');
  return parsed;
}

function jobAction(value: SourceId): AuthJob['action'] {
  return value === 'moodle' ? 'moodle.auth_probe' : 'edstem.auth_probe';
}

function transitionCode(sourceId: SourceId, transition: AuthTransition, interactionCode: AuthJobResultCode | null): AuthJobResultCode {
  if (interactionCode) return interactionCode;
  const code = transition.state.sources[sourceId].currentResultCode;
  switch (code) {
    case 'AUTHENTICATED': return 'authenticated';
    case 'NETWORK_UNAVAILABLE': return 'network_unavailable';
    case 'PARSER_CHANGED': case 'ORIGIN_MISMATCH': case 'UNKNOWN_RESULT': return 'parser_changed';
    case 'CAPABILITY_DENIED': return 'permission_denied';
    case 'AUTH_REQUIRED': return 'authentication_required';
    case 'REAUTH_REQUIRED': return 'reauth_required';
    case 'INTERACTION_REQUIRED': return 'interaction_required';
    case 'IDENTITY_MISMATCH': return 'identity_mismatch';
    case 'NOT_OBSERVED': return 'not_observed';
  }
}

/** Durable source-local auth queue. Every authority-sensitive operation is a short BEGIN IMMEDIATE transaction. */
export class SQLiteAuthJobStore implements AuthJobStore {
  constructor(private readonly db: Database.Database, private readonly clock: AuthClock = { now: () => new Date().toISOString() }) {}

  async enqueue(input: AuthProbeCommand, context: WriteContext): Promise<AuthJob> {
    const command = authCommandSchema.parse(input);
    const now = authTime(this.clock.now());
    const commandHash = digest(JSON.stringify([command.source, command.approvedConfigId, command.approvedScopeId, command.trigger]));
    return safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context);
      const control = this.control(command.source);
      const prior = this.db.prepare('SELECT * FROM source_auth_jobs WHERE source=? AND idempotency_key=?')
        .get(command.source, command.idempotencyKey) as AuthJobRow | undefined;
      if (prior) {
        if (!sameDigest(prior.command_hash, commandHash)) throw new StorageError('IDEMPOTENCY_CONFLICT');
        return this.toJob(prior);
      }
      if (control.logout_intent === 1 && command.trigger !== 'user_login_completed') throw new StorageError('EXPLICIT_LOGOUT_ACTIVE');
      if (command.trigger === 'user_login_completed' && control.logout_intent === 1) {
        this.db.prepare('UPDATE source_auth_controls SET logout_intent=0,generation=?,updated_at=? WHERE source=?')
          .run(context.expectedGeneration, now, command.source);
      }
      const id = randomUUID();
      const observation = this.db.prepare('SELECT last_success_contract FROM source_observations WHERE source=?')
        .get(command.source) as { last_success_contract: string | null } | undefined;
      const lastSuccess = observation?.last_success_contract ? sourceLastSuccessSchema.parse(JSON.parse(observation.last_success_contract)) : null;
      this.db.prepare(`INSERT INTO source_auth_jobs(
        id,source,action,trigger,idempotency_key,command_hash,approved_config_id,approved_scope_id,state,attempt,
        recovery_started_at,next_run_at,cancel_requested,fence,generation,last_success_checked_at,last_success_fingerprint,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,'queued',0,?,?,0,0,?,?,?,?,?)`).run(
        id, command.source, jobAction(command.source), command.trigger, command.idempotencyKey, commandHash,
        command.approvedConfigId, command.approvedScopeId, now, now, context.expectedGeneration,
        lastSuccess ? Date.parse(lastSuccess.checkedAt) : null, lastSuccess?.subjectFingerprint ?? null, now, now,
      );
      recordWrite(this.db, context);
      return this.getRequired(id);
    }).immediate());
  }

  async claim(input: { owner: string; now: string; leaseMs: number }, context: WriteContext): Promise<AuthJob | null> {
    const now = authTime(input.now);
    if (!input.owner || input.owner.length > 128 || !Number.isSafeInteger(input.leaseMs) || input.leaseMs < 1 || input.leaseMs > 30_000 || !Number.isSafeInteger(now + input.leaseMs)) {
      throw new StorageError('INVALID_LEASE');
    }
    return safeStorage(() => this.db.transaction(() => {
      const gate = requireWrite(this.db, context);
      const row = this.db.prepare(`SELECT j.* FROM source_auth_jobs j
        JOIN source_auth_controls c ON c.source=j.source
        WHERE j.state IN ('queued','retry_wait') AND j.cancel_requested=0 AND j.attempt<3
          AND j.next_run_at<=? AND c.logout_intent=0
        ORDER BY j.next_run_at,j.created_at,j.id LIMIT 1`).get(now) as AuthJobRow | undefined;
      if (!row) return null;
      if (now < row.updated_at) throw new StorageError('CLOCK_REGRESSION');
      const result = this.db.prepare(`UPDATE source_auth_jobs SET state='running',attempt=attempt+1,fence=fence+1,
        lease_owner=?,lease_until=?,lease_ms=?,generation=?,next_run_at=NULL,updated_at=?
        WHERE id=? AND state IN ('queued','retry_wait') AND cancel_requested=0 AND attempt<3`).run(
        input.owner, now + input.leaseMs, input.leaseMs, gate.generation, now, row.id,
      );
      if (result.changes !== 1) throw new StorageError('LEASE_LOST');
      recordWrite(this.db, context);
      return this.getRequired(row.id);
    }).immediate());
  }

  async assertCurrent(jobId: string, input: AuthJobLease, nowValue: string, context: WriteContext): Promise<AuthJob> {
    const lease = authLeaseSchema.parse(input); const now = authTime(nowValue);
    return safeStorage(() => this.db.transaction(() => this.current(jobId, lease, now, context, false)).immediate());
  }

  async heartbeat(jobId: string, input: AuthJobLease, nowValue: string, leaseMs: number, context: WriteContext): Promise<AuthJobLease> {
    const lease = authLeaseSchema.parse(input); const now = authTime(nowValue);
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 30_000 || !Number.isSafeInteger(now + leaseMs)) throw new StorageError('INVALID_LEASE');
    return safeStorage(() => this.db.transaction(() => {
      this.current(jobId, lease, now, context, false);
      const until = now + leaseMs;
      const updated = this.db.prepare(`UPDATE source_auth_jobs SET lease_until=?,lease_ms=?,updated_at=?
        WHERE id=? AND state='running' AND cancel_requested=0 AND lease_owner=? AND fence=? AND generation=? AND lease_until>?`).run(
        until, leaseMs, now, jobId, lease.owner, lease.fence, lease.generation, now,
      );
      if (updated.changes !== 1) throw new StorageError('LEASE_LOST');
      recordWrite(this.db, context);
      return { ...lease, leaseUntil: new Date(until).toISOString() };
    }).immediate());
  }

  async commitTransition(jobId: string, input: AuthJobLease, transition: AuthTransition, nowValue: string, context: WriteContext): Promise<AuthJob> {
    const lease = authLeaseSchema.parse(input); const now = authTime(nowValue);
    return safeStorage(() => this.db.transaction(() => {
      const job = this.current(jobId, lease, now, context, false);
      const row = this.getRow(jobId);
      const slot = transition.state.sources[row.source];
      const interactionCode = (transition as AuthTransition & { safeResultCode?: 'interaction_required' | 'mfa_required' }).safeResultCode ?? null;
      let code = transitionCode(row.source, transition, interactionCode);
      const schedule = transition.effects.find(effect => effect.kind === 'schedule_recovery_probe');
      const human = transition.effects.find(effect => effect.kind === 'require_user_action');
      const successful = code === 'authenticated';
      let state: AuthJob['state'] = successful ? 'succeeded' : schedule && row.attempt < 3 ? 'retry_wait' : human ? 'human_needed' : 'failed';
      let nextRunAt: number | null = null;
      if (state === 'retry_wait' && schedule) {
        nextRunAt = (row.recovery_started_at ?? row.created_at) + schedule.delayMs;
      }
      if (!successful && row.attempt >= 3 && (code === 'network_unavailable' || code === 'reauth_required')) {
        state = 'human_needed'; code = 'reauth_required'; nextRunAt = null;
      }
      const successValue = successful ? slot.observation.lastSuccess : job.lastSuccess;
      const updated = this.db.prepare(`UPDATE source_auth_jobs SET state=?,next_run_at=?,cancel_requested=0,
        lease_owner=NULL,lease_until=NULL,lease_ms=NULL,safe_result_code=?,last_success_checked_at=?,last_success_fingerprint=?,updated_at=?
        WHERE id=? AND state='running' AND cancel_requested=0 AND lease_owner=? AND fence=? AND generation=? AND lease_until>?`).run(
        state, nextRunAt, code, successValue ? Date.parse(successValue.checkedAt) : null, successValue?.subjectFingerprint ?? null, now,
        jobId, lease.owner, lease.fence, lease.generation, now,
      );
      if (updated.changes !== 1) throw new StorageError('LEASE_LOST');

      this.persistObservation(row.source, slot.observation, successValue, context.expectedGeneration);
      if (successful && row.source === 'moodle' && row.trigger === 'user_login_completed') this.enqueueEdstemFollowUp(row, now, context.expectedGeneration);
      recordWrite(this.db, context);
      return this.getRequired(jobId);
    }).immediate());
  }

  async requestCancel(jobId: string, sourceValue: SourceId, context: WriteContext): Promise<AuthJob> {
    const sourceId = source(sourceValue); const now = authTime(this.clock.now());
    return safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context, true);
      const row = this.db.prepare('SELECT * FROM source_auth_jobs WHERE id=? AND source=?').get(jobId, sourceId) as AuthJobRow | undefined;
      if (!row) throw new StorageError('AUTH_JOB_NOT_FOUND', 404);
      if (['queued', 'retry_wait', 'running'].includes(row.state)) {
        this.db.prepare(`UPDATE source_auth_jobs SET cancel_requested=1,
          state=CASE WHEN state='running' THEN state ELSE 'cancelled' END,
          next_run_at=NULL,safe_result_code=CASE WHEN state='running' THEN safe_result_code ELSE 'cancelled' END,updated_at=? WHERE id=?`).run(now, jobId);
        recordWrite(this.db, context);
      }
      return this.getRequired(jobId);
    }).immediate());
  }

  async cancelSourceForLogout(sourceValue: SourceId, context: WriteContext): Promise<void> {
    const sourceId = source(sourceValue); const now = authTime(this.clock.now());
    safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context, true);
      this.db.prepare('UPDATE source_auth_controls SET logout_intent=1,generation=?,updated_at=? WHERE source=?')
        .run(context.expectedGeneration, now, sourceId);
      this.db.prepare(`UPDATE source_auth_jobs SET cancel_requested=1,
        state=CASE WHEN state='running' THEN state ELSE 'cancelled' END,
        next_run_at=NULL,safe_result_code=CASE WHEN state='running' THEN safe_result_code ELSE 'cancelled' END,updated_at=?
        WHERE source=? AND state IN ('queued','retry_wait','running')`).run(now, sourceId);
      recordWrite(this.db, context);
    }).immediate());
  }

  async acknowledgeCancel(jobId: string, input: AuthJobLease, context: WriteContext): Promise<AuthJob> {
    const lease = authLeaseSchema.parse(input); const now = authTime(this.clock.now());
    return safeStorage(() => this.db.transaction(() => {
      this.current(jobId, lease, now, context, true);
      const updated = this.db.prepare(`UPDATE source_auth_jobs SET state='cancelled',safe_result_code='cancelled',
        lease_owner=NULL,lease_until=NULL,lease_ms=NULL,next_run_at=NULL,updated_at=?
        WHERE id=? AND state='running' AND cancel_requested=1 AND lease_owner=? AND fence=? AND generation=? AND lease_until>?`).run(
        now, jobId, lease.owner, lease.fence, lease.generation, now,
      );
      if (updated.changes !== 1) throw new StorageError('LEASE_LOST');
      recordWrite(this.db, context);
      return this.getRequired(jobId);
    }).immediate());
  }

  async recoverExpired(nowValue: string, context: WriteContext): Promise<number> {
    const now = authTime(nowValue);
    return safeStorage(() => this.db.transaction(() => {
      requireWrite(this.db, context, true);
      const rows = this.db.prepare("SELECT * FROM source_auth_jobs WHERE state='running' AND lease_until<=?").all(now) as AuthJobRow[];
      for (const row of rows) {
        const cancelled = row.cancel_requested === 1;
        const exhausted = row.attempt >= 3;
        const state: AuthJob['state'] = cancelled ? 'cancelled' : exhausted ? 'human_needed' : 'retry_wait';
        const nextRunAt = state === 'retry_wait'
          ? (row.recovery_started_at ?? row.created_at) + AUTH_RECOVERY_DELAYS_MS[row.attempt]!
          : null;
        this.db.prepare(`UPDATE source_auth_jobs SET state=?,fence=fence+1,lease_owner=NULL,lease_until=NULL,lease_ms=NULL,
          next_run_at=?,safe_result_code=?,updated_at=? WHERE id=? AND state='running' AND lease_until<=?`).run(
          state, nextRunAt, cancelled ? 'cancelled' : exhausted ? 'reauth_required' : 'lease_expired', now, row.id, now,
        );
      }
      if (rows.length) recordWrite(this.db, context);
      return rows.length;
    }).immediate());
  }

  async get(jobId: string, sourceValue: SourceId): Promise<AuthJob | null> {
    const row = this.db.prepare('SELECT * FROM source_auth_jobs WHERE id=? AND source=?').get(jobId, source(sourceValue)) as AuthJobRow | undefined;
    return row ? this.toJob(row) : null;
  }

  private control(sourceId: SourceId): { logout_intent: number } {
    const row = this.db.prepare('SELECT logout_intent FROM source_auth_controls WHERE source=?').get(sourceId) as { logout_intent: number } | undefined;
    if (!row) throw new StorageError('STORAGE_FAILURE', 503);
    return row;
  }

  private current(jobId: string, lease: AuthJobLease, now: number, context: WriteContext, allowCancelled: boolean): AuthJob {
    requireWrite(this.db, context);
    const row = this.getRow(jobId);
    if (row.generation !== context.expectedGeneration || row.generation !== lease.generation) throw new StorageError('GENERATION_MISMATCH');
    if (row.state !== 'running' || row.lease_owner !== lease.owner || row.fence !== lease.fence || row.lease_until === null || row.lease_until <= now || row.lease_until !== authTime(lease.leaseUntil)) {
      throw new StorageError('LEASE_LOST');
    }
    if (!allowCancelled && row.cancel_requested === 1) throw new StorageError('CANCEL_REQUESTED');
    if (now < row.updated_at) throw new StorageError('CLOCK_REGRESSION');
    return this.toJob(row);
  }

  private persistObservation(sourceId: SourceId, observation: SourceObservation, success: SourceLastSuccess | null, generation: number): void {
    const checkedAt = observation.checkedAt === null ? null : Date.parse(observation.checkedAt);
    const prior = this.db.prepare('SELECT last_success_contract FROM source_observations WHERE source=?').get(sourceId) as { last_success_contract: string | null } | undefined;
    const lastSuccess = success ?? (prior?.last_success_contract ? JSON.parse(prior.last_success_contract) as SourceLastSuccess : null);
    const current = SourceObservationSchema.parse({ ...observation, lastSuccess });
    this.db.prepare(`INSERT INTO source_observations(source,current_contract,last_success_contract,checked_at,generation) VALUES(?,?,?,?,?)
      ON CONFLICT(source) DO UPDATE SET current_contract=excluded.current_contract,last_success_contract=excluded.last_success_contract,
      checked_at=excluded.checked_at,generation=excluded.generation`).run(
      sourceId, JSON.stringify(current), lastSuccess ? JSON.stringify(lastSuccess) : null, checkedAt, generation,
    );
  }

  private enqueueEdstemFollowUp(parent: AuthJobRow, now: number, generation: number): void {
    const config = this.db.prepare("SELECT id,approved_scope_id FROM source_configs WHERE source='edstem' ORDER BY config_version DESC LIMIT 1")
      .get() as { id: string; approved_scope_id: string } | undefined;
    if (!config) return;
    const idempotencyKey = `${parent.id}:edstem`;
    const commandHash = digest(JSON.stringify(['edstem', config.id, config.approved_scope_id, 'moodle_reauth_follow_up']));
    this.db.prepare(`INSERT OR IGNORE INTO source_auth_jobs(
      id,source,action,trigger,idempotency_key,command_hash,approved_config_id,approved_scope_id,state,attempt,
      recovery_started_at,next_run_at,cancel_requested,fence,generation,parent_job_id,effect_kind,created_at,updated_at)
      VALUES(?,'edstem','edstem.auth_probe','moodle_reauth_follow_up',?,?,?,?,'queued',0,?,?,0,0,?,?,'moodle_reauth_follow_up',?,?)`).run(
      randomUUID(), idempotencyKey, commandHash, config.id, config.approved_scope_id, now, now, generation, parent.id, now, now,
    );
  }

  private getRow(id: string): AuthJobRow {
    const row = this.db.prepare('SELECT * FROM source_auth_jobs WHERE id=?').get(id) as AuthJobRow | undefined;
    if (!row) throw new StorageError('AUTH_JOB_NOT_FOUND', 404);
    return row;
  }
  private getRequired(id: string): AuthJob { return this.toJob(this.getRow(id)); }
  private toJob(row: AuthJobRow): AuthJob {
    const lease = row.lease_owner === null || row.lease_until === null ? null : {
      owner: row.lease_owner, fence: row.fence, generation: row.generation, leaseUntil: new Date(row.lease_until).toISOString(),
    };
    return {
      id: row.id, source: row.source, action: row.action, approvedConfigId: row.approved_config_id,
      approvedScopeId: row.approved_scope_id, trigger: row.trigger, idempotencyKey: row.idempotency_key,
      state: row.state, attempt: row.attempt,
      recoveryStartedAt: row.recovery_started_at === null ? null : new Date(row.recovery_started_at).toISOString(),
      nextRunAt: row.next_run_at === null ? null : new Date(row.next_run_at).toISOString(),
      cancelRequested: row.cancel_requested === 1, lease, generation: row.generation, resultCode: row.safe_result_code,
      lastSuccess: row.last_success_checked_at === null || row.last_success_fingerprint === null ? null : {
        checkedAt: new Date(row.last_success_checked_at).toISOString(), subjectFingerprint: row.last_success_fingerprint,
      },
      parentJobId: row.parent_job_id, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
