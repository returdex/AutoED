import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import { ZodError } from 'zod';
import type {
  AccountBindingStore, Clock, ProfileOwnershipStore, SourceConfigStore, SourceObservationStore,
} from '../../application/src/ports.js';
import type {
  AccountBinding, ApprovedSourceConfig, ProfileOwnerIdentity, ProfileOwnership, ProfileReservation,
  SourceId, SourceObservation, WriteContext,
} from '../../domain/src/model.js';
import {
  AccountBindingSchema, ApprovedSourceConfigSchema, ProfileOwnerIdentitySchema, ProfileOwnershipSchema,
  ProfileReservationSchema, SourceObservationSchema,
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
