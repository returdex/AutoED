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
  type BrowserProbeSession,
  type BrowserRequestGuard,
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
  candidates?: 'one' | 'zero' | 'many' | 'wrong-build' | 'wrong-executable' | 'wrong-start' | 'unowned';
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
  let forcedInspect: 'in_use' | 'unconfirmed' | 'confirmed_exited' | undefined;
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
      const state = inspections.shift() ?? forcedInspect ?? 'in_use';
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
  const pageHandlers = new Map<string, Array<(value: unknown) => unknown>>();
  const contextHandlers = new Map<string, Array<(value: unknown) => unknown>>();
  let currentURL = ORIGIN;
  let routeHandler: ((route: unknown) => Promise<void>) | undefined;
  let locatorValue: string | null = 'visible text';
  let attributeValue: string | null = 'available';
  let operationHook: (() => void | Promise<void>) | undefined;
  let requestPostHook: (() => void | Promise<void>) | undefined;
  let waitPromise: Promise<void> | undefined;
  const locator = {
    waitFor: vi.fn(async () => { events.push('locator-wait'); await operationHook?.(); await waitPromise; }),
    innerText: vi.fn(async () => { events.push('locator-read'); await operationHook?.(); return locatorValue; }),
    getAttribute: vi.fn(async () => { events.push('attribute-read'); await operationHook?.(); return attributeValue; }),
  };
  async function emit(handlers: Map<string, Array<(value: unknown) => unknown>>, event: string, value: unknown) {
    for (const handler of handlers.get(event) ?? []) await handler(value);
  }
  async function request(url: string, method = 'GET') {
    let continued = false; let aborted = false;
    const requestValue = { url: () => url, method: () => method };
    const route = {
      request: () => requestValue,
      continue: vi.fn(async () => { continued = true; events.push('request-continue'); }),
      abort: vi.fn(async () => { aborted = true; events.push('request-abort'); }),
    };
    if (!routeHandler) throw new Error('ROUTE_NOT_INSTALLED');
    await routeHandler(route);
    if (continued) { await requestPostHook?.(); await emit(contextHandlers, 'requestfinished', requestValue); }
    return { continued, aborted, route, request: requestValue };
  }
  const page = {
    on: vi.fn((event: string, handler: (value: unknown) => unknown) => {
      pageEvents.push(event); pageHandlers.set(event, [...(pageHandlers.get(event) ?? []), handler]); return page;
    }),
    close: vi.fn(async () => undefined),
    goto: vi.fn(async (url: string) => {
      events.push('navigate'); await operationHook?.();
      const routed = await request(url); if (routed.aborted) throw new Error('SYNTHETIC_ROUTE_ABORTED');
      currentURL = url; return null;
    }),
    url: vi.fn(() => currentURL),
    getByRole: vi.fn(() => locator), getByText: vi.fn(() => locator),
    getByLabel: vi.fn(() => locator), locator: vi.fn(() => locator),
  };
  const context = {
    pages: vi.fn(() => [page]), newPage: vi.fn(async () => page),
    route: vi.fn(async (_pattern: string, handler: (route: unknown) => Promise<void>) => { routeHandler = handler; }),
    on: vi.fn((event: string, handler: (value: unknown) => unknown) => {
      contextEvents.push(event); contextHandlers.set(event, [...(contextHandlers.get(event) ?? []), handler]); return context;
    }),
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
      if (options.candidates === 'wrong-start') return [{ ...candidate, osStartIdentity: '' }];
      if (options.candidates === 'unowned') return [{ ...candidate, ownedByWorker: false }];
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
    setInspectState(value: 'in_use' | 'unconfirmed' | 'confirmed_exited') { forcedInspect = value; },
    setInspectSequence(values: Array<'in_use' | 'unconfirmed' | 'confirmed_exited'>) { inspections.push(...values); },
    setOperationHook(value: (() => void | Promise<void>) | undefined) { operationHook = value; },
    setRequestPostHook(value: (() => void | Promise<void>) | undefined) { requestPostHook = value; },
    setLocatorValue(value: string | null) { locatorValue = value; },
    setAttributeValue(value: string | null) { attributeValue = value; },
    setWaitPromise(value: Promise<void> | undefined) { waitPromise = value; },
    request,
    emitContext(event: string, item: unknown) { return emit(contextHandlers, event, item); },
    emitPage(event: string, item: unknown) { return emit(pageHandlers, event, item); },
  };
}

function requestGuard(owner: ProfileOwnerIdentity, signal = new AbortController().signal): BrowserRequestGuard {
  return { signal, expectedGeneration: owner.generation, owner };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
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

  it.each(['zero', 'many', 'wrong-build', 'wrong-executable', 'wrong-start', 'unowned'] as const)(
    'fails closed when ownership launch discovery is %s',
    async candidates => {
      const value = fixture({ candidates });
      await expect(value.provider.openBackground(value.input, value.guard)).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
      expect(value.context.close).toHaveBeenCalledOnce();
      expect(value.coordinator.attach).not.toHaveBeenCalled();
      expect(value.release).not.toHaveBeenCalled();
    },
  );

  it('closes its context and preserves the reservation when attach fails', async () => {
    const value = fixture({ attachFailure: true });
    await expect(value.provider.openBackground(value.input, value.guard)).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
    expect(value.context.close).toHaveBeenCalledOnce();
    expect(value.release).not.toHaveBeenCalled();
  });

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

  it('strictly rejects headed-mode path, channel and handle overrides before consuming a receipt', async () => {
    for (const key of ['executablePath', 'profilePath', 'userDataDir', 'channel', 'browser']) {
      const value = fixture({ authorizer: 'valid' });
      await expect(value.provider.openOfficialLogin({
        ...value.input, actionReceiptId: randomUUID(), [key]: '/untrusted',
      } as never, value.guard)).rejects.toThrow('BROWSER_INPUT_INVALID');
      expect(value.browserType.launchPersistentContext).not.toHaveBeenCalled();
      expect(value.coordinator.reserve).not.toHaveBeenCalled();
      expect(value.events).not.toContain('authorize');
    }
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

async function openBackground(value: ReturnType<typeof fixture>): Promise<{ session: BrowserProbeSession; guard: BrowserRequestGuard }> {
  const session = await value.provider.openBackground(value.input, value.guard);
  return { session, guard: requestGuard(value.owner) };
}

describe('request guard', () => {
  it('checks cancellation, maintenance generation and exact ownership before and after every public operation', async () => {
    const value = fixture(); const opened = await openBackground(value); value.events.length = 0;
    await expect(opened.session.navigate(new URL(`${ORIGIN}/safe?discarded=yes`), opened.guard)).resolves.toEqual({
      redirectOrigins: [ORIGIN], finalOrigin: ORIGIN,
    });
    expect(value.events).toEqual([
      'generation', 'inspect', 'navigate', 'generation', 'inspect', 'request-continue',
      'generation', 'inspect', 'generation', 'inspect',
    ]);

    const abort = new AbortController(); value.setOperationHook(() => abort.abort());
    await expect(opened.session.readVisible({ kind: 'text', text: 'Status', exact: true }, requestGuard(value.owner, abort.signal)))
      .rejects.toThrow('BROWSER_ABORTED');

    value.setOperationHook(() => value.setGate({ operationId: null, generation: 5, state: 'open', owner: null, leaseUntil: null }));
    await expect(opened.session.readAttribute(
      { kind: 'role', role: 'status', exact: true }, 'aria-label', opened.guard,
    )).rejects.toThrow('BROWSER_FENCED');

    value.setGate({ operationId: null, generation: 4, state: 'open', owner: null, leaseUntil: null });
    value.setInspectState('unconfirmed'); value.setOperationHook(undefined);
    await expect(opened.session.waitFor({ kind: 'label', text: 'Account', exact: true }, opened.guard))
      .rejects.toThrow('BROWSER_FENCED');
  });

  it('checks every network request before continue and after completion, then blocks later traffic when fenced', async () => {
    const value = fixture(); const opened = await openBackground(value); value.events.length = 0;
    expect((await value.request(`${ORIGIN}/asset`, 'GET')).continued).toBe(true);
    expect(value.events).toEqual(['generation', 'inspect', 'request-continue', 'generation', 'inspect']);

    value.setGate({ operationId: null, generation: 5, state: 'open', owner: null, leaseUntil: null });
    value.events.length = 0;
    expect((await value.request(`${ORIGIN}/late`, 'GET')).continued).toBe(false);
    expect(value.events).toEqual(['generation', 'request-abort']);
  });

  it('fences a request that loses generation or ownership after continue and prevents a later continue', async () => {
    for (const kind of ['generation', 'owner'] as const) {
      const value = fixture(); await openBackground(value);
      value.setRequestPostHook(() => {
        if (kind === 'generation') value.setGate({ operationId: null, generation: 5, state: 'open', owner: null, leaseUntil: null });
        else value.setInspectState('unconfirmed');
      });
      value.events.length = 0;
      expect((await value.request(`${ORIGIN}/first`, 'GET')).continued).toBe(true);
      expect(value.events).toContain('request-continue');
      value.setRequestPostHook(undefined); value.events.length = 0;
      expect((await value.request(`${ORIGIN}/second`, 'GET')).continued).toBe(false);
      expect(value.events).not.toContain('request-continue');
      expect(value.events).toContain('request-abort');
    }
  });

  it('aborts a caller-bound request after continue and discards the navigation result', async () => {
    const value = fixture(); const opened = await openBackground(value); const controller = new AbortController();
    value.setRequestPostHook(() => controller.abort());
    await expect(opened.session.navigate(
      new URL(`${ORIGIN}/aborted`), requestGuard(value.owner, controller.signal),
    )).rejects.toThrow('BROWSER_ABORTED');
    expect(value.events).toContain('request-continue');
  });

  it('discards a late visible result when cancellation, generation or owner changes during the operation', async () => {
    const cases = ['abort', 'generation', 'owner'] as const;
    for (const kind of cases) {
      const value = fixture(); const opened = await openBackground(value); const controller = new AbortController();
      value.setLocatorValue('must-not-return');
      value.setOperationHook(() => {
        if (kind === 'abort') controller.abort();
        if (kind === 'generation') value.setGate({ operationId: null, generation: 5, state: 'open', owner: null, leaseUntil: null });
        if (kind === 'owner') value.setInspectState('unconfirmed');
      });
      await expect(opened.session.readVisible(
        { kind: 'css', selector: '[data-testid="auth"]' }, requestGuard(value.owner, controller.signal),
      )).rejects.toThrow(kind === 'abort' ? 'BROWSER_ABORTED' : 'BROWSER_FENCED');
    }
  });
});

describe('blocked interaction', () => {
  it.each([
    ['POST', 'BROWSER_WRITE_BLOCKED'], ['PUT', 'BROWSER_WRITE_BLOCKED'],
    ['PATCH', 'BROWSER_WRITE_BLOCKED'], ['DELETE', 'BROWSER_WRITE_BLOCKED'],
  ] as const)('aborts background %s requests with a fixed safe code', async (method, code) => {
    const value = fixture(); const opened = await openBackground(value);
    const routed = await value.request(`${ORIGIN}/private?secret=discarded`, method);
    expect(routed).toMatchObject({ continued: false, aborted: true });
    await expect(opened.session.readVisible({ kind: 'text', text: 'Status', exact: true }, opened.guard)).rejects.toThrow(code);
  });

  it('blocks out-of-origin traffic without returning a path or query', async () => {
    const value = fixture(); const opened = await openBackground(value);
    const routed = await value.request('http://127.0.0.1:41732/private?secret=discarded', 'GET');
    expect(routed).toMatchObject({ continued: false, aborted: true });
    let failure: unknown;
    try { await opened.session.waitFor({ kind: 'text', text: 'Status', exact: true }, opened.guard); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ message: 'BROWSER_ORIGIN_BLOCKED' });
    expect(serialized(failure)).not.toMatch(/private|secret|41732|profile-private/);
  });

  it('fails closed on a background popup, dialog or download and closes only the popup object', async () => {
    for (const [event, code] of [
      ['popup', 'BROWSER_INTERACTION_REQUIRED'], ['dialog', 'BROWSER_INTERACTION_REQUIRED'],
      ['download', 'BROWSER_DOWNLOAD_BLOCKED'],
    ] as const) {
      const value = fixture(); const opened = await openBackground(value);
      const item = { close: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined), dismiss: vi.fn(async () => undefined) };
      await value.emitPage(event, item);
      await expect(opened.session.readVisible({ kind: 'text', text: 'Status', exact: true }, opened.guard)).rejects.toThrow(code);
      if (event === 'popup') expect(item.close).toHaveBeenCalledOnce();
    }
  });

  it('allows user-driven authentication requests only in a headed authorized session and exposes no interaction methods', async () => {
    const value = fixture({ authorizer: 'valid' });
    const session = await value.provider.openOfficialLogin({ ...value.input, actionReceiptId: randomUUID() }, value.guard);
    expect((await value.request(`${ORIGIN}/official-auth`, 'POST')).continued).toBe(true);
    expect((await value.request('http://127.0.0.1:41732/outside', 'POST')).continued).toBe(false);
    for (const method of ['click', 'fill', 'type', 'press', 'submit']) expect(method in session).toBe(false);
  });
});

describe('bounded read', () => {
  it('strictly validates bounded locators and safe attributes', async () => {
    const invalid: Array<[unknown, string?]> = [
      [{ kind: 'text', text: 'Status', exact: true, evaluate: 'x' }],
      [{ kind: 'text', text: () => 'Status', exact: true }],
      [{ kind: 'css', selector: '//input' }],
      [{ kind: 'css', selector: 'xpath=//input' }],
      [{ kind: 'css', selector: 'https://outside.invalid' }],
      [{ kind: 'css', selector: 'x'.repeat(513) }],
      [{ kind: 'role', role: 'status', exact: true }, 'value'],
      [{ kind: 'role', role: 'status', exact: true }, 'password'],
      [{ kind: 'role', role: 'status', exact: true }, 'href'],
    ];
    for (const [spec, attribute] of invalid) {
      const value = fixture(); const opened = await openBackground(value);
      const call = attribute === undefined
        ? opened.session.waitFor(spec as never, opened.guard)
        : opened.session.readAttribute(spec as never, attribute, opened.guard);
      await expect(call).rejects.toThrow('BROWSER_INPUT_INVALID');
    }
  });

  it('returns only bounded strings or null and rejects oversized text and attributes', async () => {
    const value = fixture(); const opened = await openBackground(value);
    value.setLocatorValue('Authenticated'); value.setAttributeValue('current');
    await expect(opened.session.readVisible({ kind: 'text', text: 'Status', exact: true }, opened.guard)).resolves.toBe('Authenticated');
    await expect(opened.session.readAttribute(
      { kind: 'role', role: 'status', exact: true }, 'aria-current', opened.guard,
    )).resolves.toBe('current');
    value.setLocatorValue(null); value.setAttributeValue(null);
    await expect(opened.session.readVisible({ kind: 'text', text: 'Status', exact: true }, opened.guard)).resolves.toBeNull();
    await expect(opened.session.readAttribute(
      { kind: 'role', role: 'status', exact: true }, 'aria-current', opened.guard,
    )).resolves.toBeNull();
    value.setLocatorValue('x'.repeat(4097));
    await expect(opened.session.readVisible({ kind: 'text', text: 'Status', exact: true }, opened.guard))
      .rejects.toThrow('BROWSER_OUTPUT_LIMIT');
    value.setLocatorValue('ok'); value.setAttributeValue('x'.repeat(2049));
    await expect(opened.session.readAttribute(
      { kind: 'role', role: 'status', exact: true }, 'aria-label', opened.guard,
    )).rejects.toThrow('BROWSER_OUTPUT_LIMIT');
  });
});

describe('safe close', () => {
  it('rejects new work, drains an in-flight operation, closes its context and releases only after confirmed exit', async () => {
    const value = fixture(); const opened = await openBackground(value); const pending = deferred();
    value.setWaitPromise(pending.promise);
    const waiting = opened.session.waitFor({ kind: 'text', text: 'Status', exact: true }, opened.guard);
    await vi.waitFor(() => expect(value.events).toContain('locator-wait'));
    value.setInspectSequence(['in_use', 'confirmed_exited']);
    const closing = opened.session.close(opened.guard);
    await expect(opened.session.navigate(new URL(ORIGIN), opened.guard)).rejects.toThrow('BROWSER_FENCED');
    pending.resolve();
    await expect(waiting).rejects.toThrow('BROWSER_ABORTED');
    await expect(closing).resolves.toBeUndefined();
    expect(value.context.close).toHaveBeenCalledOnce();
    expect(value.release).toHaveBeenCalledOnce();
    await expect(opened.session.close(opened.guard)).resolves.toBeUndefined();
    expect(value.context.close).toHaveBeenCalledOnce();
  });

  it.each([
    ['in_use', 'PROFILE_IN_USE'], ['unconfirmed', 'PROFILE_OWNERSHIP_UNCONFIRMED'],
  ] as const)('preserves ownership when close inspection is %s', async (state, code) => {
    const value = fixture(); const opened = await openBackground(value); value.setInspectSequence(['in_use', state]);
    await expect(opened.session.close(opened.guard)).rejects.toThrow(code);
    expect(value.context.close).toHaveBeenCalledOnce();
    expect(value.release).not.toHaveBeenCalled();
  });

  it('does not let an aborted caller skip owned-context cleanup', async () => {
    const value = fixture(); const opened = await openBackground(value); value.setInspectSequence(['in_use', 'confirmed_exited']);
    const controller = new AbortController(); controller.abort();
    await expect(opened.session.close(requestGuard(value.owner, controller.signal))).resolves.toBeUndefined();
    expect(value.context.close).toHaveBeenCalledOnce(); expect(value.release).toHaveBeenCalledOnce();
  });
});
