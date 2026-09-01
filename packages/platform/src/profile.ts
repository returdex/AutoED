import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, sep } from 'node:path';
import { z } from 'zod';
import type { ProfileOwnershipCoordinator, SecretStore } from '../../application/src/ports.js';
import type { ProcessIdentity, ProfileOwnerIdentity, ProfileOwnership, ProfileReservation } from '../../domain/src/model.js';
import { ProfileOwnerIdentitySchema, ProfileOwnershipSchema, ProfileReservationSchema } from '../../contracts/src/index.js';
import { assertManagedPath, assertSafeAncestors, managedPaths, preflightRoot, type RootSelection } from './paths.js';
import { protectPath, verifyProtectedPath } from './permissions.js';
import { matchesProcess, observeProcess, type OSProcess } from './processes.js';

const MAX_RECORD_BYTES = 16_384;
const controlResponseSchema = z.strictObject({
  owner: ProfileOwnerIdentitySchema,
  proof: z.string().regex(/^[a-f0-9]{64}$/),
});
const ownershipRecordSchema = z.strictObject({
  schema: z.literal(1),
  kind: z.enum(['reservation', 'owner']),
  reservation: ProfileReservationSchema,
  owner: ProfileOwnerIdentitySchema.nullable(),
  leaseUntil: z.number().int().nonnegative(),
  maximumGeneration: z.number().int().nonnegative(),
  maximumFence: z.number().int().nonnegative(),
}).superRefine((record, context) => {
  const same = record.owner !== null && sameReservation(record.reservation, record.owner);
  if (record.kind === 'reservation' ? record.owner !== null : !same) context.addIssue({ code: 'custom', message: 'Invalid ownership record state' });
  if (record.maximumGeneration < record.reservation.generation || record.maximumFence < record.reservation.fence) {
    context.addIssue({ code: 'custom', message: 'Invalid ownership fence' });
  }
});

type OwnershipRecord = z.infer<typeof ownershipRecordSchema>;

export interface ProfileControlChallenge {
  challenge: string;
  owner: ProfileOwnerIdentity;
}

export interface ProfileControlClient {
  request(challenge: ProfileControlChallenge): Promise<unknown>;
}

export interface FileProfileOwnershipCoordinatorOptions {
  selection: RootSelection;
  installationId: string;
  browserBuildId: string;
  browserExecutable: string;
  secrets: SecretStore;
  control: ProfileControlClient;
  observe?: (pid: number) => Promise<OSProcess | null>;
  clock?: { now(): number };
  leaseMs?: number;
}

function within(parent: string, child: string): boolean {
  const suffix = relative(parent, child);
  return suffix === '' || (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${sep}`));
}

function sameReservation(left: ProfileReservation, right: ProfileReservation): boolean {
  return left.installationId === right.installationId && left.browserBuildId === right.browserBuildId &&
    left.nonce === right.nonce && left.generation === right.generation && left.fence === right.fence &&
    left.reservedAt === right.reservedAt;
}

function sameOwner(left: ProfileOwnerIdentity, right: ProfileOwnerIdentity): boolean {
  return sameReservation(left, right) && left.pid === right.pid && left.osStartIdentity === right.osStartIdentity &&
    left.executable === right.executable && left.startedAt === right.startedAt;
}

function flushDirectory(path: string): void {
  if (process.platform !== 'darwin') return;
  const descriptor = openSync(path, 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function safeError(code: 'PROFILE_OWNERSHIP_UNCONFIRMED' | 'PROFILE_IN_USE'): Error {
  return new Error(code);
}

export class FileProfileOwnershipCoordinator implements ProfileOwnershipCoordinator {
  private readonly recordPath: string;
  private readonly installationId: string;
  private readonly browserBuildId: string;
  private readonly browserExecutable: string;
  private readonly clock: { now(): number };
  private readonly leaseMs: number;
  private readonly observe: (pid: number) => Promise<OSProcess | null>;
  private readonly secrets: SecretStore;
  private readonly control: ProfileControlClient;

  constructor(options: FileProfileOwnershipCoordinatorOptions) {
    try {
      z.uuid().parse(options.installationId);
      z.string().regex(/^[a-f0-9]{64}$/).parse(options.browserBuildId);
      preflightRoot(options.selection);
      const paths = managedPaths(options.selection.root);
      const profile = assertManagedPath(paths, 'profile-private');
      const runtime = assertManagedPath(paths, 'runtime');
      if (profile !== paths.profile || runtime !== paths.runtime) throw new Error('managed');
      for (const path of [paths.root, profile, runtime, paths.browser]) verifyProtectedPath(path);
      if (!isAbsolute(options.browserExecutable) || !within(paths.browser, options.browserExecutable)) throw new Error('browser');
      assertSafeAncestors(options.browserExecutable);
      if (!lstatSync(options.browserExecutable).isFile() || realpathSync(options.browserExecutable) !== options.browserExecutable) throw new Error('browser');
      verifyProtectedPath(options.browserExecutable);
      const leaseMs = options.leaseMs ?? 60_000;
      if (!Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 300_000) throw new Error('lease');
      this.recordPath = assertManagedPath(paths, 'runtime/profile-ownership.json');
      this.installationId = options.installationId;
      this.browserBuildId = options.browserBuildId;
      this.browserExecutable = options.browserExecutable;
      this.clock = options.clock ?? { now: () => Date.now() };
      this.leaseMs = leaseMs;
      this.observe = options.observe ?? observeProcess;
      this.secrets = options.secrets;
      this.control = options.control;
    } catch {
      throw safeError('PROFILE_OWNERSHIP_UNCONFIRMED');
    }
  }

  async reserve(input: { installationId: string; browserBuildId: string; generation: number; fence: number }): Promise<ProfileOwnership> {
    const now = this.clock.now();
    let reservation: ProfileReservation;
    try {
      reservation = ProfileReservationSchema.parse({ ...input, nonce: randomUUID(), reservedAt: new Date(now).toISOString() });
      if (reservation.installationId !== this.installationId || reservation.browserBuildId !== this.browserBuildId || !Number.isSafeInteger(now)) {
        throw new Error('identity');
      }
    } catch { throw safeError('PROFILE_OWNERSHIP_UNCONFIRMED'); }
    const leaseUntil = now + this.leaseMs;
    if (!Number.isSafeInteger(leaseUntil)) throw safeError('PROFILE_OWNERSHIP_UNCONFIRMED');
    const candidate: OwnershipRecord = ownershipRecordSchema.parse({
      schema: 1, kind: 'reservation', reservation, owner: null, leaseUntil,
      maximumGeneration: reservation.generation, maximumFence: reservation.fence,
    });
    try {
      this.writeExclusive(candidate);
      return this.reserved(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return this.unconfirmed(reservation);
    }
    let current: OwnershipRecord;
    try { current = this.readRecord(); } catch { return this.unconfirmed(reservation); }
    if (reservation.generation > current.maximumGeneration || reservation.fence > current.maximumFence) {
      const fenced = ownershipRecordSchema.parse({
        ...current,
        maximumGeneration: Math.max(current.maximumGeneration, reservation.generation),
        maximumFence: Math.max(current.maximumFence, reservation.fence),
      });
      try { this.replaceRecord(fenced, JSON.stringify(current)); current = fenced; } catch { return this.unconfirmed(current.reservation); }
    }
    return this.inUse(current);
  }

  async attach(
    reservationInput: ProfileReservation,
    processInput: { pid: number; osStartIdentity: string; executable: string; startedAt: string },
  ): Promise<ProfileOwnership> {
    try {
      const reservation = ProfileReservationSchema.parse(reservationInput);
      const owner = ProfileOwnerIdentitySchema.parse({ ...reservation, ...processInput });
      const current = this.readRecord();
      if (current.kind !== 'reservation' || !sameReservation(current.reservation, reservation) ||
          current.maximumGeneration !== reservation.generation || current.maximumFence !== reservation.fence ||
          reservation.installationId !== this.installationId || reservation.browserBuildId !== this.browserBuildId ||
          owner.executable !== this.browserExecutable || realpathSync(owner.executable) !== this.browserExecutable) {
        throw new Error('identity');
      }
      const next = ownershipRecordSchema.parse({ ...current, kind: 'owner', owner });
      this.replaceRecord(next, JSON.stringify(current));
      return this.owned(next);
    } catch { throw safeError('PROFILE_OWNERSHIP_UNCONFIRMED'); }
  }

  async inspect(ownerInput: ProfileOwnerIdentity): Promise<ProfileOwnership> {
    let owner: ProfileOwnerIdentity;
    let current: OwnershipRecord;
    try {
      owner = ProfileOwnerIdentitySchema.parse(ownerInput);
      current = this.readRecord();
      if (current.kind !== 'owner' || current.owner === null || !sameOwner(current.owner, owner)) return this.unconfirmed(current.reservation, current.owner);
    } catch { throw safeError('PROFILE_OWNERSHIP_UNCONFIRMED'); }
    return this.unconfirmed(current.reservation, current.owner);
  }

  async release(_owner: ProfileOwnerIdentity): Promise<void> {
    throw safeError('PROFILE_OWNERSHIP_UNCONFIRMED');
  }

  private readRecord(): OwnershipRecord {
    const stat = lstatSync(this.recordPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 2 || stat.size > MAX_RECORD_BYTES) throw new Error('record');
    verifyProtectedPath(this.recordPath);
    return ownershipRecordSchema.parse(JSON.parse(readFileSync(this.recordPath, 'utf8')));
  }

  private writeExclusive(record: OwnershipRecord): void {
    const bytes = JSON.stringify(ownershipRecordSchema.parse(record));
    if (Buffer.byteLength(bytes) > MAX_RECORD_BYTES) throw new Error('record');
    const descriptor = openSync(this.recordPath, 'wx', 0o600);
    try { protectPath(this.recordPath); writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
    flushDirectory(dirname(this.recordPath));
  }

  private replaceRecord(record: OwnershipRecord, expected: string): void {
    const bytes = JSON.stringify(ownershipRecordSchema.parse(record));
    if (Buffer.byteLength(bytes) > MAX_RECORD_BYTES || readFileSync(this.recordPath, 'utf8') !== expected) throw new Error('record');
    const pending = assertManagedPath(managedPaths(dirname(dirname(this.recordPath))), `runtime/profile-ownership.${randomUUID()}.pending`);
    let created = false;
    try {
      const descriptor = openSync(pending, 'wx', 0o600); created = true;
      try { protectPath(pending); writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
      if (readFileSync(this.recordPath, 'utf8') !== expected) throw new Error('record');
      renameSync(pending, this.recordPath); created = false; flushDirectory(dirname(this.recordPath));
    } finally { if (created && existsSync(pending)) unlinkSync(pending); }
  }

  private reserved(record: OwnershipRecord): ProfileOwnership {
    return ProfileOwnershipSchema.parse({ state: 'reserved', disposition: 'proceed', resultCode: 'PROFILE_RESERVED', reservation: record.reservation, owner: null, leaseUntil: record.leaseUntil });
  }

  private owned(record: OwnershipRecord): ProfileOwnership {
    return ProfileOwnershipSchema.parse({ state: 'owned', disposition: 'proceed', resultCode: 'PROFILE_OWNED', reservation: record.reservation, owner: record.owner, leaseUntil: record.leaseUntil });
  }

  private inUse(record: OwnershipRecord): ProfileOwnership {
    return ProfileOwnershipSchema.parse({ state: 'in_use', disposition: 'human_needed', resultCode: 'PROFILE_IN_USE', reservation: record.reservation, owner: record.owner, leaseUntil: record.leaseUntil });
  }

  private unconfirmed(reservation: ProfileReservation, owner: ProfileOwnerIdentity | null = null): ProfileOwnership {
    return ProfileOwnershipSchema.parse({ state: 'unconfirmed', disposition: 'human_needed', resultCode: 'PROFILE_OWNERSHIP_UNCONFIRMED', reservation, owner, leaseUntil: null });
  }

  private processMatches(owner: ProfileOwnerIdentity, observation: OSProcess | null): boolean {
    const adapter: ProcessIdentity = {
      installationId: owner.installationId, role: 'worker', buildId: owner.browserBuildId, pid: owner.pid,
      nonce: owner.nonce, osStartIdentity: owner.osStartIdentity, executable: owner.executable,
    };
    return matchesProcess(adapter, observation);
  }

  private async authenticated(owner: ProfileOwnerIdentity): Promise<boolean> {
    const challenge: ProfileControlChallenge = { challenge: randomUUID(), owner };
    const key = await this.secrets.get(owner.installationId, 'api');
    if (!key) return false;
    const parsed = controlResponseSchema.parse(await this.control.request(challenge));
    if (!sameOwner(parsed.owner, owner)) return false;
    const expected = createHmac('sha256', key).update(JSON.stringify(challenge)).digest('hex');
    return timingSafeEqual(Buffer.from(parsed.proof, 'hex'), Buffer.from(expected, 'hex'));
  }
}
