import { randomUUID } from 'node:crypto';
import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaintenanceStore, ProfileOwnershipCoordinator } from '../../packages/application/src/ports.js';
import type { MaintenanceGate, ProfileOwnerIdentity, ProfileOwnership, ProfileReservation } from '../../packages/domain/src/model.js';
import { createManagedRoot, type RootSelection } from '../../packages/platform/src/paths.js';
import { protectPath } from '../../packages/platform/src/permissions.js';
import {
  LocalPlaywrightBrowserProvider,
  type BrowserOpenGuard,
} from '../../packages/platform/src/browser.js';
import { createHarness } from '../../packages/test-support/src/harness.js';

const BUILD_ID = '5'.repeat(64);
const CONFIG_ID = 'approved-config';
const ORIGIN = 'http://127.0.0.1:41731';
const harnesses: ReturnType<typeof createHarness>[] = [];

afterEach(async () => {
  while (harnesses.length) await harnesses.pop()!.cleanup();
});

function ownership(
  state: ProfileOwnership['state'],
  reservation: ProfileReservation,
  owner: ProfileOwnerIdentity | null,
): ProfileOwnership {
  const projections = {
    reserved: ['proceed', 'PROFILE_RESERVED'],
    owned: ['proceed', 'PROFILE_OWNED'],
    in_use: ['human_needed', 'PROFILE_IN_USE'],
    unconfirmed: ['human_needed', 'PROFILE_OWNERSHIP_UNCONFIRMED'],
    confirmed_exited: ['cleanup_allowed', 'PROFILE_CONFIRMED_EXITED'],
  } as const;
  const [disposition, resultCode] = projections[state as keyof typeof projections];
  return { state, disposition, resultCode, reservation, owner, leaseUntil: 70_000 } as ProfileOwnership;
}

function fixture(options: {
  candidates?: 'one' | 'zero' | 'many' | 'wrong-build' | 'wrong-executable';
  reserveState?: 'reserved' | 'in_use' | 'unconfirmed';
  attachFailure?: boolean;
  inspect?: Array<'in_use' | 'unconfirmed' | 'confirmed_exited'>;
  authorizer?: 'valid' | 'reject' | 'missing';
} = {}) {
  const harness = createHarness(); harnesses.push(harness);
  const parent = realpathSync(harness.root); protectPath(parent);
  const selection: RootSelection = { root: join(parent, 'installation'), parent, excludedRoots: [] };
  const paths = createManagedRoot(selection);
  const executable = join(paths.browser, 'managed-chromium');
  writeFileSync(executable, 'synthetic browser executable', { mode: 0o600 }); protectPath(executable);
  const installationId = randomUUID();
  const reservation: ProfileReservation = {
    installationId, browserBuildId: BUILD_ID, nonce: randomUUID(), generation: 4, fence: 9,
    reservedAt: new Date(1_000).toISOString(),
  };
  const owner: ProfileOwnerIdentity = {
    ...reservation, pid: 4242, osStartIdentity: 'synthetic-start', executable,
    startedAt: new Date(1_001).toISOString(),
  };
  const events: string[] = [];
  const release = vi.fn(async () => { events.push('release'); });
  const inspections = [...(options.inspect ?? [])];
  const coordinator: ProfileOwnershipCoordinator = {
    reserve: vi.fn(async () => {
      events.push('reserve');
      const state = options.reserveState ?? 'reserved';
      return ownership(state, reservation, state === 'in_use' ? owner : null);
    }),
    attach: vi.fn(async (_reservation, process) => {
      events.push('attach');
      if (options.attachFailure) throw new Error('PROFILE_OWNERSHIP_UNCONFIRMED');
      return ownership('owned', reservation, { ...reservation, ...process });
    }),
    inspect: vi.fn(async () => {
      events.push('inspect');
      const state = inspections.shift() ?? 'in_use';
      return ownership(state, reservation, state === 'unconfirmed' ? null : owner);
    }),
    release,
  };
  let gate: MaintenanceGate = { operationId: null, generation: 4, state: 'open', owner: null, leaseUntil: null };
  const maintenance: MaintenanceStore = {
    read: vi.fn(async () => { events.push('generation'); return gate; }),
    enterMaintenance: vi.fn(), markExclusive: vi.fn(), exitMaintenance: vi.fn(),
  };
  const pageEvents: string[] = [];
  const contextEvents: string[] = [];
  const page = {
    on: vi.fn((event: string) => { pageEvents.push(event); return page; }),
    close: vi.fn(async () => undefined),
    goto: vi.fn(), url: vi.fn(() => ORIGIN),
    getByRole: vi.fn(), getByText: vi.fn(), getByLabel: vi.fn(), locator: vi.fn(),
  };
  const context = {
    pages: vi.fn(() => [page]), newPage: vi.fn(async () => page),
    route: vi.fn(async () => undefined),
    on: vi.fn((event: string) => { contextEvents.push(event); return context; }),
    close: vi.fn(async () => { events.push('close-context'); }),
  };
  const launches: Array<{ userDataDir: string; launchOptions: Record<string, unknown> }> = [];
  const browserType = {
    launchPersistentContext: vi.fn(async (userDataDir: string, launchOptions: Record<string, unknown>) => {
      events.push('launch'); launches.push({ userDataDir, launchOptions }); return context;
    }),
  };
  let snapshots = 0;
  const observer = {
    snapshot: vi.fn(async () => {
      events.push(snapshots++ === 0 ? 'snapshot-before' : 'snapshot-after');
      if (snapshots === 1) return [];
      const candidate = { ...owner, browserBuildId: BUILD_ID, ownedByWorker: true };
      if (options.candidates === 'zero') return [];
      if (options.candidates === 'many') return [candidate, { ...candidate, pid: 4343, osStartIdentity: 'other-start' }];
      if (options.candidates === 'wrong-build') return [{ ...candidate, browserBuildId: '6'.repeat(64) }];
      if (options.candidates === 'wrong-executable') return [{ ...candidate, executable: process.execPath }];
      return [candidate];
    }),
  };
  const consumed = new Set<string>();
  const authorizer = options.authorizer === 'missing' ? undefined : {
    consume: vi.fn(async (input: { actionReceiptId: string; source: string; approvedConfigId: string }) => {
      events.push('authorize');
      if (options.authorizer === 'reject' || consumed.has(input.actionReceiptId)) throw new Error('DENIED');
      consumed.add(input.actionReceiptId);
      return { authorized: true as const, ...input };
    }),
  };
  const provider = new LocalPlaywrightBrowserProvider({
    selection,
    installation: { installationId },
    inventory: { browserBuildId: BUILD_ID, executable },
    coordinator,
    maintenance,
    browserType,
    observer,
    ...(authorizer ? { humanLoginActions: authorizer } : {}),
  });
  const input = {
    installationId, browserBuildId: BUILD_ID, approvedConfigId: CONFIG_ID, source: 'moodle' as const,
    readOrigins: [ORIGIN], authenticationOrigins: [ORIGIN], generation: 4, fence: 9,
  };
  const guard: BrowserOpenGuard = { signal: new AbortController().signal, expectedGeneration: 4 };
  return {
    provider, input, guard, launches, browserType, observer, coordinator, release, events, paths,
    context, page, contextEvents, pageEvents, owner, reservation,
    setGate(value: MaintenanceGate) { gate = value; },
  };
}

function serialized(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === 'function' ? '[function]' : item).toLowerCase();
}

describe('managed persistent context', () => {
  it('uses only the internally verified executable and dedicated Profile with capture disabled', async () => {
    const value = fixture();
    const session = await value.provider.openBackground(value.input, value.guard);
    expect(value.launches).toEqual([{
      userDataDir: value.paths.profile,
      launchOptions: {
        executablePath: value.owner.executable, headless: true, acceptDownloads: false,
        bypassCSP: false, serviceWorkers: 'block',
      },
    }]);
    expect(value.events.slice(0, 7)).toEqual([
      'generation', 'reserve', 'snapshot-before', 'launch', 'snapshot-after', 'attach', 'generation',
    ]);
    expect(value.events[7]).toBe('inspect');
    expect(serialized(value.launches)).not.toMatch(/artifactsdir|downloadspath|recordhar|recordvideo|trace|screenshot|logger|devtools|storagestate|cookie/);
    expect(serialized(session)).toBe('{}');
    expect(value.contextEvents).not.toContain('console');
    expect(value.pageEvents).not.toContain('console');
  });

  it.each(['executablePath', 'profilePath', 'userDataDir', 'channel', 'browser', 'headless']) (
    'strictly rejects the public %s override before ownership or launch',
    async key => {
      const value = fixture();
      await expect(value.provider.openBackground({ ...value.input, [key]: '/untrusted' } as never, value.guard))
        .rejects.toThrow('BROWSER_INPUT_INVALID');
      expect(value.browserType.launchPersistentContext).not.toHaveBeenCalled();
      expect(value.coordinator.reserve).not.toHaveBeenCalled();
    },
  );

  it.each(['zero', 'many', 'wrong-build', 'wrong-executable'] as const)(
    'fails closed when ownership launch discovery is %s',
    async candidates => {
      const value = fixture({ candidates });
      await expect(value.provider.openBackground(value.input, value.guard)).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
      expect(value.context.close).toHaveBeenCalledOnce();
      expect(value.coordinator.attach).not.toHaveBeenCalled();
      expect(value.release).not.toHaveBeenCalled();
    },
  );

  it('does not launch when reservation is held or ownership is unknown', async () => {
    for (const reserveState of ['in_use', 'unconfirmed'] as const) {
      const value = fixture({ reserveState });
      await expect(value.provider.openBackground(value.input, value.guard)).rejects.toThrow(
        reserveState === 'in_use' ? 'PROFILE_IN_USE' : 'PROFILE_OWNERSHIP_UNCONFIRMED',
      );
      expect(value.browserType.launchPersistentContext).not.toHaveBeenCalled();
    }
  });

  it('closes only its context and releases only after a post-attach confirmed exit', async () => {
    const value = fixture({ inspect: ['unconfirmed', 'confirmed_exited'] });
    await expect(value.provider.openBackground(value.input, value.guard)).rejects.toThrow('BROWSER_FENCED');
    expect(value.context.close).toHaveBeenCalledOnce();
    expect(value.release).toHaveBeenCalledOnce();
  });
});

describe('human-action headed gate', () => {
  it('keeps background headless and opens headed mode only after a bound one-time receipt is consumed', async () => {
    const background = fixture();
    await background.provider.openBackground(background.input, background.guard);
    expect(background.launches[0]!.launchOptions.headless).toBe(true);

    const value = fixture({ authorizer: 'valid' });
    const actionReceiptId = randomUUID();
    await value.provider.openOfficialLogin({ ...value.input, actionReceiptId }, value.guard);
    expect(value.events.indexOf('authorize')).toBeLessThan(value.events.indexOf('reserve'));
    expect(value.launches[0]!.launchOptions.headless).toBe(false);
    await expect(value.provider.openOfficialLogin({ ...value.input, actionReceiptId }, value.guard))
      .rejects.toThrow('BROWSER_HUMAN_ACTION_REQUIRED');
    expect(value.browserType.launchPersistentContext).toHaveBeenCalledOnce();
  });

  it.each(['missing', 'reject'] as const)('does not launch when the human-action authorizer is %s', async authorizer => {
    const value = fixture({ authorizer });
    await expect(value.provider.openOfficialLogin({ ...value.input, actionReceiptId: randomUUID() }, value.guard))
      .rejects.toThrow('BROWSER_HUMAN_ACTION_REQUIRED');
    expect(value.browserType.launchPersistentContext).not.toHaveBeenCalled();
    expect(value.coordinator.reserve).not.toHaveBeenCalled();
  });

  it('rejects a receipt whose source or config binding is changed before launch', async () => {
    const value = fixture({ authorizer: 'reject' });
    await expect(value.provider.openOfficialLogin({ ...value.input, source: 'edstem', actionReceiptId: randomUUID() }, value.guard))
      .rejects.toThrow('BROWSER_HUMAN_ACTION_REQUIRED');
    await expect(value.provider.openOfficialLogin({ ...value.input, approvedConfigId: 'other-config', actionReceiptId: randomUUID() }, value.guard))
      .rejects.toThrow('BROWSER_HUMAN_ACTION_REQUIRED');
    expect(value.browserType.launchPersistentContext).not.toHaveBeenCalled();
  });
});

describe('capture disabled ownership launch', () => {
  it('never exposes a raw context, page, browser, Profile location or capture configuration', async () => {
    const value = fixture();
    const session = await value.provider.openBackground(value.input, value.guard);
    const exposed = serialized(session);
    for (const forbidden of [value.paths.profile, 'cookie', 'page', 'context', 'browser', 'storage', 'trace', 'video', 'screenshot']) {
      expect(exposed).not.toContain(forbidden.toLowerCase());
    }
    expect(Object.keys(session).sort()).toEqual([]);
  });
});
