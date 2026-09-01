import { afterEach, describe, expect, it } from 'vitest';
import { createNativeProfileHarness, type NativeProfileHarness } from '../../packages/test-support/src/native-profile-harness.js';

const harnesses: NativeProfileHarness[] = [];

afterEach(async () => {
  while (harnesses.length > 0) await harnesses.pop()!.cleanup();
});

async function harness(): Promise<NativeProfileHarness> {
  const value = await createNativeProfileHarness();
  harnesses.push(value);
  return value;
}

describe('native macOS managed Profile ownership and lifecycle', () => {
  it('permissions protect a fresh repository-external Profile without sensitive output', async () => {
    const value = await harness();
    expect(await value.verifyPermissions()).toMatchObject({ platform: 'macos', evidence: 'N', protected: true });
  });

  it('single instance fails before a second managed Chromium launch', async () => {
    const value = await harness();
    expect(await value.verifySingleInstance()).toMatchObject({ firstLaunches: 1, secondLaunches: 0, code: 'PROFILE_IN_USE' });
  });

  it('normal close waits for OS exit and fences the old request guard', async () => {
    const value = await harness();
    expect(await value.verifyNormalClose()).toMatchObject({ exited: true, released: true, oldGuardFenced: true });
  });

  it('lease fencing never reclaims a running browser', async () => {
    const value = await harness();
    expect(await value.verifyLeaseFencing()).toMatchObject({ code: 'PROFILE_IN_USE', launches: 1, productSignals: 0 });
  });

  it('PID reuse and control proof mismatches stay ownership-unconfirmed', async () => {
    const value = await harness();
    expect(await value.verifyPidReuse()).toMatchObject({ unconfirmed: 3, productSignals: 0, holderAlive: true });
  });

  it('capture remains disabled and every request is loopback-only', async () => {
    const value = await harness();
    expect(await value.verifyCaptureBoundary()).toMatchObject({ externalRequests: 0, sensitiveCaptures: 0 });
  });

  it('worker crash keeps browser ownership separate until confirmed exit', async () => {
    const value = await harness();
    expect(await value.verifyWorkerCrash()).toMatchObject({ workerExited: true, browserSeparated: true, lateCommits: 0 });
  });

  it('cancel aborts in-flight work with no late request or commit', async () => {
    const value = await harness();
    expect(await value.verifyCancel()).toMatchObject({ aborted: true, lateRequests: 0, lateCommits: 0 });
  });

  it('lease loss and generation fence stop work before request and commit', async () => {
    const value = await harness();
    expect(await value.verifyAuthorityLoss()).toMatchObject({ blockedStages: 3, productSignals: 0 });
  });

  it('Codex boundary keeps detached installation processes alive after launcher exit', async () => {
    const value = await harness();
    expect(await value.verifyCodexBoundary()).toMatchObject({ scenario: 'native_process_boundary', evidence: 'N', launcherExited: true, servicesAlive: true });
  });

  it('owned reclaim rejects every incomplete or unregistered proof', async () => {
    const value = await harness();
    expect(await value.verifyOwnedReclaim()).toMatchObject({ exactReclaimed: 1, rejected: 6, unrelatedAlive: true });
  });

  it('N evidence cannot write live, Windows or another scenario cell', async () => {
    const value = await harness();
    expect(await value.verifyNativeEvidence()).toMatchObject({ macosN: 2, rejected: 3, windows: 'not_run', live: 'human_needed', phase3: 'blocked' });
  });
});
