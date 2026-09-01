import { createHmac, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs';
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

function fixture(now = 1_000) {
  const harness = createHarness(); harnesses.push(harness); protectPath(harness.root);
  const selection: RootSelection = { root: join(harness.root, 'installation'), parent: harness.root, excludedRoots: [] };
  const paths = createManagedRoot(selection);
  const browserExecutable = join(paths.browser, 'managed-browser');
  writeFileSync(browserExecutable, 'synthetic executable identity', { mode: 0o600 }); protectPath(browserExecutable);
  const installationId = randomUUID();
  let current = now;
  const coordinator = new FileProfileOwnershipCoordinator({
    selection, installationId, browserBuildId: BUILD_ID, browserExecutable,
    clock: { now: () => current }, leaseMs: 60_000,
    secrets: new SyntheticSecretStore(),
    observe: async () => { throw new Error('SYNTHETIC_OBSERVATION_NOT_CONFIGURED'); },
    control: { request: async () => { throw new Error('SYNTHETIC_CONTROL_NOT_CONFIGURED'); } },
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
  return JSON.stringify(value).toLowerCase();
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
    expect(await value.coordinator.attach(reservation, processIdentity(value))).toMatchObject({
      state: 'owned', disposition: 'proceed', resultCode: 'PROFILE_OWNED', owner: processIdentity(value),
    });
  });

  it('never treats lease expiry or a higher generation and fence as exit or permission for a second holder', async () => {
    const value = fixture();
    const first = await value.coordinator.reserve(reserveInput(value));
    value.setNow(first.leaseUntil! + 1);
    const expired = await value.coordinator.reserve(reserveInput(value));
    const fenced = await value.coordinator.reserve(reserveInput(value, 1, 1));
    for (const result of [expired, fenced]) expect(result).toMatchObject({
      state: 'in_use', disposition: 'human_needed', resultCode: 'PROFILE_IN_USE',
      reservation: { nonce: first.reservation!.nonce },
    });
    expect(JSON.parse(readFileSync(value.ownershipRecord, 'utf8'))).toMatchObject({
      reservation: { nonce: first.reservation!.nonce }, maximumGeneration: 1, maximumFence: 1,
    });
    await expect(value.coordinator.attach(first.reservation!, processIdentity(value))).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
  });

  it('derives only the protected managed Profile and fails closed for repository, legacy, excluded, cloud and linked roots', () => {
    const value = fixture();
    expect(verifyProtectedPath(value.paths.profile)).toBe(true);
    expect(verifyProtectedPath(value.paths.runtime)).toBe(true);
    const result = ProfileOwnershipSchema.parse({ state: 'available', disposition: 'proceed', resultCode: 'PROFILE_AVAILABLE', reservation: null, owner: null, leaseUntil: null });
    const forbidden = [value.paths.profile, 'cookie', 'storagestate', 'password', 'token', '<html', 'header', 'body'];
    for (const sentinel of forbidden) expect(safeStrings(result)).not.toContain(sentinel.toLowerCase());

    const linkedParent = join(value.harness.root, 'linked-parent'); symlinkSync(value.harness.root, linkedParent, 'dir');
    const invalid: RootSelection[] = [
      { root: join(resolve('.'), 'synthetic-profile-installation'), parent: resolve('.'), excludedRoots: [] },
      { root: join(homedir(), 'Documents', 'AutoED', 'synthetic-profile-installation'), parent: join(homedir(), 'Documents', 'AutoED'), excludedRoots: [] },
      { root: join(value.harness.root, 'excluded', 'installation'), parent: join(value.harness.root, 'excluded'), excludedRoots: [join(value.harness.root, 'excluded')] },
      { root: join(value.harness.root, 'Dropbox', 'installation'), parent: join(value.harness.root, 'Dropbox'), excludedRoots: [] },
      { root: join(linkedParent, 'installation'), parent: linkedParent, excludedRoots: [] },
    ];
    for (const selection of invalid) {
      expect(() => new FileProfileOwnershipCoordinator({
        selection, installationId: value.installationId, browserBuildId: BUILD_ID, browserExecutable: value.browserExecutable,
        secrets: new SyntheticSecretStore(), control: { request: async () => ({}) },
      })).toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    }
  });
});

export function syntheticProof(challenge: ProfileControlChallenge, owner: ProfileOwnerIdentity) {
  return {
    owner,
    proof: createHmac('sha256', CONTROL_SECRET).update(JSON.stringify(challenge)).digest('hex'),
  };
}
