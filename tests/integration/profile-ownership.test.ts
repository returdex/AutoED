import { createHmac, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfileOwnershipSchema } from '../../packages/contracts/src/index.js';
import type { SecretStore } from '../../packages/application/src/ports.js';
import type { ProfileOwnerIdentity } from '../../packages/domain/src/model.js';
import { FileProfileOwnershipCoordinator, type ProfileControlChallenge } from '../../packages/platform/src/profile.js';
import { createManagedRoot, type RootSelection } from '../../packages/platform/src/paths.js';
import { protectPath, verifyProtectedPath } from '../../packages/platform/src/permissions.js';
import { createHarness } from '../../packages/test-support/src/harness.js';

const BUILD_ID = 'b'.repeat(64);
const CONTROL_SECRET = 'synthetic-profile-control-secret';
const harnesses: ReturnType<typeof createHarness>[] = [];

afterEach(async () => {
  while (harnesses.length) await harnesses.pop()!.cleanup();
});

class SyntheticSecretStore implements SecretStore {
  async get(_installationId: string, name: string) { return name === 'api' ? CONTROL_SECRET : null; }
  async set() { throw new Error('TEST_WRITE_FORBIDDEN'); }
  async delete() { throw new Error('TEST_DELETE_FORBIDDEN'); }
}

function fixture(now = 1_000, overrides: {
  observe?: (pid: number) => Promise<{ osStartIdentity: string; executable: string } | null>;
  control?: { request(challenge: ProfileControlChallenge): Promise<unknown> };
  controlTimeoutMs?: number;
} = {}) {
  const harness = createHarness(); harnesses.push(harness); const parent = realpathSync(harness.root); protectPath(parent);
  const selection: RootSelection = { root: join(parent, 'installation'), parent, excludedRoots: [] };
  const paths = createManagedRoot(selection);
  const browserExecutable = join(paths.browser, 'managed-browser');
  writeFileSync(browserExecutable, 'synthetic executable identity', { mode: 0o600 }); protectPath(browserExecutable);
  const installationId = randomUUID();
  let current = now;
  const coordinator = new FileProfileOwnershipCoordinator({
    selection, installationId, browserBuildId: BUILD_ID, browserExecutable,
    clock: { now: () => current }, leaseMs: 60_000,
    secrets: new SyntheticSecretStore(),
    observe: overrides.observe ?? (async () => { throw new Error('SYNTHETIC_OBSERVATION_NOT_CONFIGURED'); }),
    control: overrides.control ?? { request: async () => { throw new Error('SYNTHETIC_CONTROL_NOT_CONFIGURED'); } },
    ...(overrides.controlTimeoutMs === undefined ? {} : { controlTimeoutMs: overrides.controlTimeoutMs }),
  });
  return {
    harness, selection, paths, browserExecutable, installationId, coordinator,
    ownershipRecord: join(paths.runtime, 'profile-ownership.json'),
    setNow(value: number) { current = value; },
  };
}

function reserveInput(value: ReturnType<typeof fixture>, generation = 0, fence = 0) {
  return { installationId: value.installationId, browserBuildId: BUILD_ID, generation, fence };
}

function processIdentity(value: ReturnType<typeof fixture>) {
  return {
    pid: 4242, osStartIdentity: 'synthetic-start-identity', executable: value.browserExecutable,
    startedAt: new Date(1_000).toISOString(),
  };
}

function safeStrings(value: unknown): string {
  return `${value instanceof Error ? value.message : ''} ${JSON.stringify(value)}`.toLowerCase();
}

function expectSafe(value: unknown, profilePath: string) {
  for (const sentinel of [profilePath, 'cookie', 'storagestate', 'password', 'token', '<html', 'authorization', 'request body', 'control key']) {
    expect(safeStrings(value)).not.toContain(sentinel.toLowerCase());
  }
}

describe('protected Profile reservation and fencing', () => {
  it('atomically admits one of two concurrent reservations and returns the strict in-use projection for the other', async () => {
    const value = fixture();
    const results = await Promise.all([
      value.coordinator.reserve(reserveInput(value)),
      value.coordinator.reserve(reserveInput(value)),
    ]);
    const reserved = results.filter(result => result.resultCode === 'PROFILE_RESERVED');
    const rejected = results.filter(result => result.resultCode === 'PROFILE_IN_USE');
    expect(reserved).toHaveLength(1); expect(rejected).toHaveLength(1);
    expect(ProfileOwnershipSchema.parse(reserved[0])).toMatchObject({ state: 'reserved', disposition: 'proceed' });
    expect(ProfileOwnershipSchema.parse(rejected[0])).toMatchObject({ state: 'in_use', disposition: 'human_needed' });
    const record = JSON.parse(readFileSync(value.ownershipRecord, 'utf8')) as { reservation: { nonce: string; fence: number } };
    expect(record.reservation).toEqual(expect.objectContaining({ nonce: reserved[0]!.reservation!.nonce, fence: reserved[0]!.reservation!.fence }));
  });

  it('attaches only the exact current reservation and managed executable without mutating the record on rejected identities', async () => {
    const value = fixture();
    const reserved = await value.coordinator.reserve(reserveInput(value));
    const reservation = reserved.reservation!;
    const original = readFileSync(value.ownershipRecord);
    const forged = [
      { ...reservation, fence: reservation.fence + 1 },
      { ...reservation, generation: reservation.generation + 1 },
      { ...reservation, installationId: randomUUID() },
      { ...reservation, browserBuildId: 'c'.repeat(64) },
      { ...reservation, nonce: randomUUID() },
    ];
    for (const candidate of forged) {
      await expect(value.coordinator.attach(candidate, processIdentity(value))).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
      expect(readFileSync(value.ownershipRecord)).toEqual(original);
    }
    await expect(value.coordinator.attach(reservation, { ...processIdentity(value), executable: process.execPath }))
      .rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    expect(readFileSync(value.ownershipRecord)).toEqual(original);
    const owned = await value.coordinator.attach(reservation, processIdentity(value));
    expect(owned).toMatchObject({
      state: 'owned', disposition: 'proceed', resultCode: 'PROFILE_OWNED', owner: processIdentity(value),
    });
    const attached = readFileSync(value.ownershipRecord);
    await expect(value.coordinator.release({ ...owned.owner!, nonce: randomUUID() })).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    expect(readFileSync(value.ownershipRecord)).toEqual(attached);
  });

  it('never treats lease expiry or a higher generation and fence as exit or permission for a second holder', async () => {
    const value = fixture();
    const first = await value.coordinator.reserve(reserveInput(value));
    const owned = await value.coordinator.attach(first.reservation!, processIdentity(value));
    value.setNow(first.leaseUntil! + 1);
    const expired = await value.coordinator.reserve(reserveInput(value));
    const fenced = await value.coordinator.reserve(reserveInput(value, 1, 1));
    for (const result of [expired, fenced]) expect(result).toMatchObject({
      state: 'in_use', disposition: 'human_needed', resultCode: 'PROFILE_IN_USE',
      reservation: { nonce: first.reservation!.nonce }, owner: { nonce: owned.owner!.nonce },
    });
    expect(JSON.parse(readFileSync(value.ownershipRecord, 'utf8'))).toMatchObject({
      reservation: { nonce: first.reservation!.nonce }, maximumGeneration: 1, maximumFence: 1,
    });
    await expect(value.coordinator.attach(first.reservation!, processIdentity(value))).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
  });

  it('derives only the protected managed Profile and fails closed for repository, legacy, excluded, cloud and linked roots', async () => {
    const value = fixture();
    expect(verifyProtectedPath(value.paths.profile)).toBe(true);
    expect(verifyProtectedPath(value.paths.runtime)).toBe(true);
    const result = ProfileOwnershipSchema.parse({ state: 'available', disposition: 'proceed', resultCode: 'PROFILE_AVAILABLE', reservation: null, owner: null, leaseUntil: null });
    const forbidden = [value.paths.profile, 'cookie', 'storagestate', 'password', 'token', '<html', 'header', 'body'];
    for (const sentinel of forbidden) expect(safeStrings(result)).not.toContain(sentinel.toLowerCase());

    const parent = value.selection.parent;
    const linkedParent = join(parent, 'linked-parent'); symlinkSync(parent, linkedParent, 'dir');
    const invalid: RootSelection[] = [
      { root: join(resolve('.'), 'synthetic-profile-installation'), parent: resolve('.'), excludedRoots: [resolve('.')] },
      { root: join(homedir(), 'Documents', 'AutoED', 'synthetic-profile-installation'), parent: join(homedir(), 'Documents', 'AutoED'), excludedRoots: [] },
      { root: join(parent, 'excluded', 'installation'), parent: join(parent, 'excluded'), excludedRoots: [join(parent, 'excluded')] },
      { root: join(parent, 'Dropbox', 'installation'), parent: join(parent, 'Dropbox'), excludedRoots: [] },
      { root: join(linkedParent, 'installation'), parent: linkedParent, excludedRoots: [] },
    ];
    for (const selection of invalid) {
      let failure: unknown;
      try {
        new FileProfileOwnershipCoordinator({
          selection, installationId: value.installationId, browserBuildId: BUILD_ID, browserExecutable: value.browserExecutable,
          secrets: new SyntheticSecretStore(), control: { request: async () => ({}) },
        });
      } catch (error) { failure = error; }
      expect(failure).toMatchObject({ message: 'PROFILE_OWNERSHIP_UNCONFIRMED' });
      for (const sentinel of forbidden) expect(safeStrings(failure)).not.toContain(sentinel.toLowerCase());
    }
    await value.coordinator.reserve(reserveInput(value)); expect(verifyProtectedPath(value.ownershipRecord)).toBe(true);
  });
});

export function syntheticProof(challenge: ProfileControlChallenge, owner: ProfileOwnerIdentity) {
  return {
    owner,
    proof: createHmac('sha256', CONTROL_SECRET).update(JSON.stringify(challenge)).digest('hex'),
  };
}

async function attached(value: ReturnType<typeof fixture>) {
  const reserved = await value.coordinator.reserve(reserveInput(value));
  return value.coordinator.attach(reserved.reservation!, processIdentity(value));
}

function exactDependencies() {
  return {
    observe: async (_pid: number) => ({ osStartIdentity: 'synthetic-start-identity', executable: '' }),
    control: { request: async (challenge: ProfileControlChallenge) => syntheticProof(challenge, challenge.owner) },
  };
}

describe('conservative OS and authenticated control proof', () => {
  it('reports an exact running holder as in use only after OS and challenge-bound control proof both match', async () => {
    let browserExecutable = '';
    const value = fixture(1_000, {
      observe: async pid => { expect(pid).toBe(4242); return { osStartIdentity: 'synthetic-start-identity', executable: browserExecutable }; },
      control: { request: async challenge => syntheticProof(challenge, challenge.owner) },
    });
    browserExecutable = value.browserExecutable;
    const owned = await attached(value); const original = readFileSync(value.ownershipRecord);
    expect(await value.coordinator.inspect(owned.owner!)).toMatchObject({
      state: 'in_use', disposition: 'human_needed', resultCode: 'PROFILE_IN_USE', owner: owned.owner,
    });
    expect(readFileSync(value.ownershipRecord)).toEqual(original);
  });

  it('keeps the record for PID reuse, wrong executable, wrong caller identity, OS failure and invalid control proofs', async () => {
    const cases: Array<{
      name: string;
      observation: 'reuse' | 'executable' | 'throw' | 'exact';
      owner?: (owner: ProfileOwnerIdentity) => ProfileOwnerIdentity;
      control?: 'valid' | 'throw' | 'invalid';
    }> = [
      { name: 'PID reuse', observation: 'reuse' },
      { name: 'wrong executable', observation: 'executable' },
      { name: 'wrong installation', observation: 'exact', owner: owner => ({ ...owner, installationId: randomUUID() }) },
      { name: 'wrong nonce', observation: 'exact', owner: owner => ({ ...owner, nonce: randomUUID() }) },
      { name: 'OS permission/query failure', observation: 'throw' },
      { name: 'control failure', observation: 'exact', control: 'throw' },
      { name: 'invalid control proof', observation: 'exact', control: 'invalid' },
    ];
    for (const item of cases) {
      let executable = '';
      const value = fixture(1_000, {
        observe: async () => {
          if (item.observation === 'throw') throw new Error('SYNTHETIC_OS_PERMISSION');
          if (item.observation === 'reuse') return { osStartIdentity: 'reused-pid-start', executable };
          if (item.observation === 'executable') return { osStartIdentity: 'synthetic-start-identity', executable: process.execPath };
          return { osStartIdentity: 'synthetic-start-identity', executable };
        },
        control: { request: async challenge => {
          if (item.control === 'throw') throw new Error('SYNTHETIC_CONTROL_TIMEOUT');
          if (item.control === 'invalid') return { owner: challenge.owner, proof: '0'.repeat(64) };
          return syntheticProof(challenge, challenge.owner);
        } },
      });
      executable = value.browserExecutable;
      const owned = await attached(value); const original = readFileSync(value.ownershipRecord);
      const caller = item.owner ? item.owner(owned.owner!) : owned.owner!;
      expect(await value.coordinator.inspect(caller), item.name).toMatchObject({
        state: 'unconfirmed', disposition: 'human_needed', resultCode: 'PROFILE_OWNERSHIP_UNCONFIRMED',
      });
      expect(readFileSync(value.ownershipRecord), item.name).toEqual(original);
    }
  });

  it('rejects replayed and non-responsive control proofs without changing ownership', async () => {
    let executable = ''; let prior: ProfileControlChallenge | undefined;
    const value = fixture(1_000, {
      observe: async () => ({ osStartIdentity: 'synthetic-start-identity', executable }),
      control: { request: async challenge => {
        if (!prior) { prior = challenge; return syntheticProof(challenge, challenge.owner); }
        return syntheticProof(prior, challenge.owner);
      } },
    });
    executable = value.browserExecutable;
    const owned = await attached(value); const original = readFileSync(value.ownershipRecord);
    expect((await value.coordinator.inspect(owned.owner!)).resultCode).toBe('PROFILE_IN_USE');
    expect(await value.coordinator.inspect(owned.owner!)).toMatchObject({ resultCode: 'PROFILE_OWNERSHIP_UNCONFIRMED' });
    expect(readFileSync(value.ownershipRecord)).toEqual(original);

    let timeoutExecutable = '';
    const timeout = fixture(1_000, {
      observe: async () => ({ osStartIdentity: 'synthetic-start-identity', executable: timeoutExecutable }),
      control: { request: async () => new Promise<never>(() => undefined) }, controlTimeoutMs: 5,
    });
    timeoutExecutable = timeout.browserExecutable;
    const timeoutOwner = await attached(timeout); const timeoutOriginal = readFileSync(timeout.ownershipRecord);
    expect(await timeout.coordinator.inspect(timeoutOwner.owner!)).toMatchObject({ resultCode: 'PROFILE_OWNERSHIP_UNCONFIRMED' });
    expect(readFileSync(timeout.ownershipRecord)).toEqual(timeoutOriginal);
  });

  it('cleans only after exact OS absence is confirmed and then admits a higher fence', async () => {
    let observations = 0;
    const value = fixture(1_000, { observe: async () => { observations++; return null; } });
    const owned = await attached(value);
    expect(await value.coordinator.inspect(owned.owner!)).toMatchObject({
      state: 'confirmed_exited', disposition: 'cleanup_allowed', resultCode: 'PROFILE_CONFIRMED_EXITED',
    });
    expect(existsSync(value.ownershipRecord)).toBe(true);
    await value.coordinator.release(owned.owner!);
    expect(observations).toBe(2);
    expect(existsSync(value.ownershipRecord)).toBe(false);
    await expect(value.coordinator.reserve(reserveInput(value, 0, 0))).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    expect(existsSync(value.ownershipRecord)).toBe(false);
    const next = await value.coordinator.reserve(reserveInput(value, 1, 1));
    expect(next).toMatchObject({ state: 'reserved', resultCode: 'PROFILE_RESERVED', reservation: { generation: 1, fence: 1 } });
    const nextBytes = readFileSync(value.ownershipRecord);
    await expect(value.coordinator.release(owned.owner!)).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    expect(readFileSync(value.ownershipRecord)).toEqual(nextBytes);
  });

  it('refuses release for running, unknown or mismatched owners even after lease expiry', async () => {
    const observations: Array<'running' | 'unknown' | 'mismatch'> = ['running', 'unknown', 'mismatch'];
    for (const state of observations) {
      let executable = '';
      const valid = exactDependencies();
      const value = fixture(1_000, {
        observe: async () => {
          if (state === 'unknown') throw new Error('SYNTHETIC_OS_UNKNOWN');
          return { osStartIdentity: state === 'mismatch' ? 'reused' : 'synthetic-start-identity', executable };
        }, control: valid.control,
      });
      executable = value.browserExecutable;
      const owned = await attached(value); value.setNow(owned.leaseUntil! + 1);
      const original = readFileSync(value.ownershipRecord);
      await expect(value.coordinator.release(owned.owner!)).rejects.toThrow(state === 'running' ? 'PROFILE_IN_USE' : 'PROFILE_OWNERSHIP_UNCONFIRMED');
      expect(readFileSync(value.ownershipRecord)).toEqual(original);
    }
  });

  it('lets a fenced historical owner be inspected but never release, reattach or overwrite the current record', async () => {
    let executable = '';
    const value = fixture(1_000, {
      observe: async () => ({ osStartIdentity: 'synthetic-start-identity', executable }),
      control: { request: async challenge => syntheticProof(challenge, challenge.owner) },
    });
    executable = value.browserExecutable;
    const owned = await attached(value);
    expect((await value.coordinator.reserve(reserveInput(value, 2, 3))).resultCode).toBe('PROFILE_IN_USE');
    const fenced = readFileSync(value.ownershipRecord);
    expect((await value.coordinator.inspect(owned.owner!)).resultCode).toBe('PROFILE_IN_USE');
    await expect(value.coordinator.release(owned.owner!)).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    await expect(value.coordinator.attach(owned.reservation!, processIdentity(value))).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    expect(readFileSync(value.ownershipRecord)).toEqual(fenced);
  });

  it('keeps every coordinator projection and typed failure free of the Profile location and sensitive browser data', async () => {
    let executable = '';
    const value = fixture(1_000, {
      observe: async () => ({ osStartIdentity: 'synthetic-start-identity', executable }),
      control: { request: async challenge => syntheticProof(challenge, challenge.owner) },
    });
    executable = value.browserExecutable;
    const reserved = await value.coordinator.reserve(reserveInput(value));
    const owned = await value.coordinator.attach(reserved.reservation!, processIdentity(value));
    const running = await value.coordinator.inspect(owned.owner!);
    for (const projection of [reserved, owned, running]) expectSafe(projection, value.paths.profile);
    let failure: unknown;
    try { await value.coordinator.release({ ...owned.owner!, nonce: randomUUID() }); }
    catch (error) { failure = error; }
    expectSafe(failure, value.paths.profile);

    const exited = fixture(1_000, { observe: async () => null });
    const exitedOwner = await attached(exited);
    expectSafe(await exited.coordinator.inspect(exitedOwner.owner!), exited.paths.profile);
  });
});
