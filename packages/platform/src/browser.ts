import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { z } from 'zod';
import type { BrowserContext, BrowserType, ChromiumBrowser, Locator, Page, Request, Route } from 'playwright';
import type { MaintenanceStore, ProfileOwnershipCoordinator } from '../../application/src/ports.js';
import type { ProfileOwnerIdentity, ProfileReservation, SourceId } from '../../domain/src/model.js';
import { ProfileOwnerIdentitySchema } from '../../contracts/src/index.js';
import { managedPaths, preflightRoot, type RootSelection } from './paths.js';
import { verifyProtectedPath } from './permissions.js';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const origin = z.string().min(1).max(2048).refine(value => {
  try {
    const parsed = new URL(value);
    return parsed.origin === value && (parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)));
  } catch { return false; }
}, 'origin');
const browserOpenInputSchema = z.strictObject({
  installationId: z.uuid(),
  browserBuildId: hash,
  approvedConfigId: z.string().min(1).max(128),
  source: z.enum(['moodle', 'edstem']),
  readOrigins: z.array(origin).min(1).max(8),
  authenticationOrigins: z.array(origin).min(1).max(8),
  generation: z.number().int().nonnegative(),
  fence: z.number().int().nonnegative(),
});
const interactiveLoginOpenInputSchema = browserOpenInputSchema.extend({ actionReceiptId: z.uuid() });
const boundedText = z.string().min(1).max(512).refine(value => !value.includes('\0'));
const locatorSpecSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('role'), role: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/), name: boundedText.optional(), exact: z.literal(true) }),
  z.strictObject({ kind: z.literal('text'), text: boundedText, exact: z.literal(true) }),
  z.strictObject({ kind: z.literal('label'), text: boundedText, exact: z.literal(true) }),
  z.strictObject({ kind: z.literal('css'), selector: boundedText.refine(value =>
    !/^\s*(?:\/\/|xpath=)/i.test(value) && !value.includes('://'), 'selector') }),
]);
const safeAttributeSchema = z.enum(['aria-label', 'aria-current', 'aria-expanded', 'aria-selected', 'role', 'title', 'data-testid']);

export interface BrowserOpenInput {
  installationId: string;
  browserBuildId: string;
  approvedConfigId: string;
  source: SourceId;
  readOrigins: string[];
  authenticationOrigins: string[];
  generation: number;
  fence: number;
}

export interface InteractiveLoginOpenInput extends BrowserOpenInput { actionReceiptId: string }

export interface BrowserOpenGuard {
  signal: AbortSignal;
  expectedGeneration: number;
}

export interface BrowserRequestGuard {
  signal: AbortSignal;
  expectedGeneration: number;
  owner: ProfileOwnerIdentity;
}

export type BrowserLocatorSpec =
  | { kind: 'role'; role: string; name?: string; exact: true }
  | { kind: 'text'; text: string; exact: true }
  | { kind: 'label'; text: string; exact: true }
  | { kind: 'css'; selector: string };

export interface NavigationObservation {
  redirectOrigins: string[];
  finalOrigin: string;
}

export interface BrowserProbeSession {
  navigate(target: URL, guard: BrowserRequestGuard): Promise<NavigationObservation>;
  waitFor(locator: BrowserLocatorSpec, guard: BrowserRequestGuard): Promise<'visible'>;
  readVisible(locator: BrowserLocatorSpec, guard: BrowserRequestGuard): Promise<string | null>;
  readAttribute(locator: BrowserLocatorSpec, attribute: string, guard: BrowserRequestGuard): Promise<string | null>;
  close(guard: BrowserRequestGuard): Promise<void>;
}

interface HumanLoginActionAuthorizer {
  consume(input: { actionReceiptId: string; source: SourceId; approvedConfigId: string }): Promise<unknown>;
}

interface ManagedChromiumCandidate {
  pid: number;
  osStartIdentity: string;
  executable: string;
  startedAt: string;
  browserBuildId: string;
  ownedByWorker: boolean;
}

interface ManagedChromiumProcessObserver {
  snapshot(input: { browserBuildId: string; executable: string; workerPid: number }): Promise<readonly ManagedChromiumCandidate[]>;
}

interface LocalPlaywrightBrowserProviderOptions {
  selection: RootSelection;
  installation: { installationId: string };
  inventory: { browserBuildId: string; executable: string };
  coordinator: ProfileOwnershipCoordinator;
  maintenance: MaintenanceStore;
  browserType: object;
  observer: ManagedChromiumProcessObserver;
  humanLoginActions?: HumanLoginActionAuthorizer;
}

type BrowserCode =
  | 'BROWSER_ABORTED'
  | 'BROWSER_FENCED'
  | 'BROWSER_HUMAN_ACTION_REQUIRED'
  | 'BROWSER_INPUT_INVALID'
  | 'BROWSER_INTERACTION_REQUIRED'
  | 'BROWSER_DOWNLOAD_BLOCKED'
  | 'BROWSER_WRITE_BLOCKED'
  | 'BROWSER_ORIGIN_BLOCKED'
  | 'BROWSER_OUTPUT_LIMIT'
  | 'PROFILE_IN_USE'
  | 'PROFILE_OWNERSHIP_UNCONFIRMED';

class BrowserFailure extends Error {
  readonly code: BrowserCode;
  constructor(code: BrowserCode) { super(code); this.name = 'BrowserFailure'; this.code = code; }
}

function safeFailure(error: unknown, fallback: BrowserCode): BrowserFailure {
  if (error instanceof BrowserFailure) return error;
  if (error instanceof Error && ['PROFILE_IN_USE', 'PROFILE_OWNERSHIP_UNCONFIRMED'].includes(error.message)) {
    return new BrowserFailure(error.message as BrowserCode);
  }
  return new BrowserFailure(fallback);
}

function within(parent: string, child: string): boolean {
  const suffix = relative(parent, child);
  return suffix === '' || (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${sep}`));
}

function sameOwner(left: ProfileOwnerIdentity | null, right: ProfileOwnerIdentity): boolean {
  return left !== null && JSON.stringify(ProfileOwnerIdentitySchema.parse(left)) === JSON.stringify(ProfileOwnerIdentitySchema.parse(right));
}

function candidateKey(candidate: Pick<ManagedChromiumCandidate, 'pid' | 'osStartIdentity'>): string {
  return `${candidate.pid}:${candidate.osStartIdentity}`;
}

class SealedBrowserProbeSession implements BrowserProbeSession {
  #context: BrowserContext;
  #page: Page;
  #owner: ProfileOwnerIdentity;
  #coordinator: ProfileOwnershipCoordinator;
  #maintenance: MaintenanceStore;
  #mode: 'background' | 'interactive';
  #readOrigins: ReadonlySet<string>;
  #authenticationOrigins: ReadonlySet<string>;
  #lifecycle = new AbortController();
  #failure: BrowserFailure | null = null;
  #closing = false;
  #contextClosed = false;
  #released = false;
  #activeGuard: BrowserRequestGuard | null = null;
  #operations = new Set<Promise<unknown>>();
  #networkChecks = new Set<Promise<void>>();
  #requestGuards = new WeakMap<object, BrowserRequestGuard>();
  #navigationOrigins: string[] | null = null;

  static async create(input: {
    context: BrowserContext;
    page: Page;
    owner: ProfileOwnerIdentity;
    coordinator: ProfileOwnershipCoordinator;
    maintenance: MaintenanceStore;
    mode: 'background' | 'interactive';
    readOrigins: readonly string[];
    authenticationOrigins: readonly string[];
  }): Promise<SealedBrowserProbeSession> {
    const session = new SealedBrowserProbeSession(input);
    await input.context.route('**/*', route => session.#route(route));
    input.context.on('requestfinished', request => session.#networkPost(request));
    input.context.on('requestfailed', request => session.#networkPost(request));
    input.context.on('page', page => session.#extraPage(page));
    session.#guardPage(input.page);
    return session;
  }

  private constructor(input: {
    context: BrowserContext;
    page: Page;
    owner: ProfileOwnerIdentity;
    coordinator: ProfileOwnershipCoordinator;
    maintenance: MaintenanceStore;
    mode: 'background' | 'interactive';
    readOrigins: readonly string[];
    authenticationOrigins: readonly string[];
  }) {
    this.#context = input.context;
    this.#page = input.page;
    this.#owner = ProfileOwnerIdentitySchema.parse(input.owner);
    this.#coordinator = input.coordinator;
    this.#maintenance = input.maintenance;
    this.#mode = input.mode;
    this.#readOrigins = new Set(input.readOrigins);
    this.#authenticationOrigins = new Set(input.authenticationOrigins);
  }

  async navigate(target: URL, guard: BrowserRequestGuard): Promise<NavigationObservation> {
    let targetOrigin: string;
    try {
      if (!(target instanceof URL)) throw new Error('target');
      targetOrigin = target.origin;
      if (!this.#originAllowed(targetOrigin, 'GET')) throw new Error('origin');
    } catch { throw new BrowserFailure('BROWSER_ORIGIN_BLOCKED'); }
    return this.#run(guard, async () => {
      this.#navigationOrigins = [];
      try {
        await this.#page.goto(target.href, { waitUntil: 'domcontentloaded' });
        const finalOrigin = this.#safeOrigin(this.#page.url());
        if (!this.#originAllowed(finalOrigin, 'GET')) throw new BrowserFailure('BROWSER_ORIGIN_BLOCKED');
        const redirectOrigins = [...this.#navigationOrigins];
        if (!redirectOrigins.includes(finalOrigin)) redirectOrigins.push(finalOrigin);
        return { redirectOrigins, finalOrigin };
      } finally { this.#navigationOrigins = null; }
    });
  }

  async waitFor(spec: BrowserLocatorSpec, guard: BrowserRequestGuard): Promise<'visible'> {
    const locator = this.#locator(spec);
    return this.#run(guard, async () => { await locator.waitFor({ state: 'visible' }); return 'visible' as const; });
  }

  async readVisible(spec: BrowserLocatorSpec, guard: BrowserRequestGuard): Promise<string | null> {
    const locator = this.#locator(spec);
    return this.#run(guard, async () => this.#bounded(await locator.innerText(), 4096, 8192));
  }

  async readAttribute(spec: BrowserLocatorSpec, attributeInput: string, guard: BrowserRequestGuard): Promise<string | null> {
    const locator = this.#locator(spec);
    let attribute: z.infer<typeof safeAttributeSchema>;
    try { attribute = safeAttributeSchema.parse(attributeInput); }
    catch { throw new BrowserFailure('BROWSER_INPUT_INVALID'); }
    return this.#run(guard, async () => this.#bounded(await locator.getAttribute(attribute), 2048, 4096));
  }

  async close(guard: BrowserRequestGuard): Promise<void> {
    if (this.#released) return;
    this.#assertGuardIdentity(guard);
    this.#closing = true;
    this.#lifecycle.abort();
    const inFlight = [...this.#operations];
    if (inFlight.length > 0) {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          Promise.allSettled(inFlight),
          new Promise<void>(resolve => { timer = setTimeout(resolve, 2_000); timer.unref(); }),
        ]);
      } finally { if (timer) clearTimeout(timer); }
    }
    await this.#assertCleanupCurrent(guard);
    if (!this.#contextClosed) {
      try { await this.#context.close(); this.#contextClosed = true; }
      catch { /* Actual process state below is authoritative. */ }
    }
    const state = await this.#coordinator.inspect(this.#owner);
    if (state.resultCode === 'PROFILE_CONFIRMED_EXITED' && sameOwner(state.owner, this.#owner)) {
      await this.#coordinator.release(this.#owner); this.#released = true; return;
    }
    throw new BrowserFailure(state.resultCode === 'PROFILE_IN_USE' && sameOwner(state.owner, this.#owner)
      ? 'PROFILE_IN_USE' : 'PROFILE_OWNERSHIP_UNCONFIRMED');
  }

  #locator(input: BrowserLocatorSpec): Locator {
    let spec: z.infer<typeof locatorSpecSchema>;
    try { spec = locatorSpecSchema.parse(input); }
    catch { throw new BrowserFailure('BROWSER_INPUT_INVALID'); }
    switch (spec.kind) {
      case 'role': return this.#page.getByRole(spec.role as never, { ...(spec.name === undefined ? {} : { name: spec.name }), exact: true });
      case 'text': return this.#page.getByText(spec.text, { exact: true });
      case 'label': return this.#page.getByLabel(spec.text, { exact: true });
      case 'css': return this.#page.locator(spec.selector);
    }
  }

  #bounded(value: string | null, characters: number, bytes: number): string | null {
    if (value === null) return null;
    if (value.length > characters || Buffer.byteLength(value, 'utf8') > bytes) throw new BrowserFailure('BROWSER_OUTPUT_LIMIT');
    return value;
  }

  async #run<T>(guard: BrowserRequestGuard, operation: () => Promise<T>): Promise<T> {
    if (this.#closing || this.#activeGuard !== null) throw new BrowserFailure('BROWSER_FENCED');
    const task = (async () => {
      await this.#assertCurrent(guard);
      this.#activeGuard = guard;
      let result: T;
      try { result = await operation(); }
      catch (error) {
        if (this.#failure) throw this.#failure;
        throw safeFailure(error, this.#lifecycle.signal.aborted ? 'BROWSER_ABORTED' : 'BROWSER_FENCED');
      } finally { this.#activeGuard = null; }
      if (this.#networkChecks.size > 0) await Promise.allSettled([...this.#networkChecks]);
      if (this.#failure) throw this.#failure;
      await this.#assertCurrent(guard);
      return result;
    })();
    this.#operations.add(task);
    try { return await task; } finally { this.#operations.delete(task); }
  }

  #assertGuardIdentity(guard: BrowserRequestGuard): void {
    try {
      if (guard.expectedGeneration !== this.#owner.generation || !sameOwner(ProfileOwnerIdentitySchema.parse(guard.owner), this.#owner)) {
        throw new Error('guard');
      }
    } catch { throw new BrowserFailure('BROWSER_FENCED'); }
  }

  async #assertCurrent(guard: BrowserRequestGuard): Promise<void> {
    if (this.#failure) throw this.#failure;
    this.#assertGuardIdentity(guard);
    if (guard.signal.aborted || this.#lifecycle.signal.aborted) throw new BrowserFailure('BROWSER_ABORTED');
    const gate = await this.#maintenance.read();
    if (guard.signal.aborted || this.#lifecycle.signal.aborted) throw new BrowserFailure('BROWSER_ABORTED');
    if (gate.state !== 'open' || gate.generation !== guard.expectedGeneration) throw new BrowserFailure('BROWSER_FENCED');
    const state = await this.#coordinator.inspect(this.#owner);
    if (guard.signal.aborted || this.#lifecycle.signal.aborted) throw new BrowserFailure('BROWSER_ABORTED');
    if (state.resultCode !== 'PROFILE_IN_USE' || !sameOwner(state.owner, this.#owner)) throw new BrowserFailure('BROWSER_FENCED');
  }

  async #assertCleanupCurrent(guard: BrowserRequestGuard): Promise<void> {
    const gate = await this.#maintenance.read();
    if (gate.state !== 'open' || gate.generation !== guard.expectedGeneration) throw new BrowserFailure('BROWSER_FENCED');
    const state = await this.#coordinator.inspect(this.#owner);
    if (state.resultCode !== 'PROFILE_IN_USE' || !sameOwner(state.owner, this.#owner)) throw new BrowserFailure('BROWSER_FENCED');
  }

  #ambientGuard(): BrowserRequestGuard {
    return this.#activeGuard ?? { signal: this.#lifecycle.signal, expectedGeneration: this.#owner.generation, owner: this.#owner };
  }

  async #route(route: Route): Promise<void> {
    const request = route.request();
    const guard = this.#ambientGuard();
    try {
      await this.#assertCurrent(guard);
      const requestOrigin = this.#safeOrigin(request.url());
      const method = request.method().toUpperCase();
      if (!this.#originAllowed(requestOrigin, method)) {
        const code = this.#methodAllowed(method) ? 'BROWSER_ORIGIN_BLOCKED' : 'BROWSER_WRITE_BLOCKED';
        this.#fail(code); await route.abort('blockedbyclient'); return;
      }
      this.#requestGuards.set(request, guard);
      if (this.#navigationOrigins && !this.#navigationOrigins.includes(requestOrigin)) this.#navigationOrigins.push(requestOrigin);
      await route.continue();
    } catch (error) {
      this.#fail(safeFailure(error, 'BROWSER_FENCED').code);
      try { await route.abort('blockedbyclient'); } catch { /* Route may already be resolved. */ }
    }
  }

  #networkPost(request: Request): Promise<void> {
    const guard = this.#requestGuards.get(request);
    if (!guard) return Promise.resolve();
    const check = this.#assertCurrent(guard).catch(error => { this.#fail(safeFailure(error, 'BROWSER_FENCED').code); });
    this.#networkChecks.add(check);
    void check.finally(() => this.#networkChecks.delete(check));
    return check;
  }

  #methodAllowed(method: string): boolean {
    return this.#mode === 'background' ? ['GET', 'HEAD'].includes(method) : ['GET', 'HEAD', 'POST', 'OPTIONS'].includes(method);
  }

  #originAllowed(value: string, method: string): boolean {
    if (!this.#methodAllowed(method)) return false;
    return this.#mode === 'background'
      ? this.#readOrigins.has(value) || this.#authenticationOrigins.has(value)
      : this.#authenticationOrigins.has(value);
  }

  #safeOrigin(value: string): string {
    try { return new URL(value).origin; }
    catch { throw new BrowserFailure('BROWSER_ORIGIN_BLOCKED'); }
  }

  #fail(code: BrowserCode): void {
    if (!this.#failure) this.#failure = new BrowserFailure(code);
  }

  #guardPage(page: Page): void {
    page.on('popup', popup => {
      if (this.#mode === 'background') { this.#fail('BROWSER_INTERACTION_REQUIRED'); void popup.close().catch(() => undefined); }
    });
    page.on('download', download => { this.#fail('BROWSER_DOWNLOAD_BLOCKED'); void download.cancel().catch(() => undefined); });
    page.on('dialog', dialog => {
      if (this.#mode === 'background') { this.#fail('BROWSER_INTERACTION_REQUIRED'); void dialog.dismiss().catch(() => undefined); }
    });
  }

  #extraPage(page: Page): void {
    if (page === this.#page) return;
    if (this.#mode === 'background') { this.#fail('BROWSER_INTERACTION_REQUIRED'); void page.close().catch(() => undefined); return; }
    this.#guardPage(page);
  }
}

/** The only production boundary that may create the installation's persistent browser context. */
export class LocalPlaywrightBrowserProvider {
  #selection: RootSelection;
  #installationId: string;
  #browserBuildId: string;
  #executable: string;
  #profile: string;
  #coordinator: ProfileOwnershipCoordinator;
  #maintenance: MaintenanceStore;
  #browserType: object;
  #observer: ManagedChromiumProcessObserver;
  #humanLoginActions: HumanLoginActionAuthorizer | undefined;

  constructor(options: LocalPlaywrightBrowserProviderOptions) {
    try {
      preflightRoot(options.selection);
      const paths = managedPaths(options.selection.root);
      z.uuid().parse(options.installation.installationId);
      hash.parse(options.inventory.browserBuildId);
      for (const path of [paths.root, paths.profile, paths.browser, options.inventory.executable]) verifyProtectedPath(path);
      if (!isAbsolute(options.inventory.executable) || !within(paths.browser, options.inventory.executable) ||
          realpathSync(options.inventory.executable) !== options.inventory.executable || !lstatSync(options.inventory.executable).isFile()) {
        throw new Error('inventory');
      }
      this.#selection = options.selection;
      this.#installationId = options.installation.installationId;
      this.#browserBuildId = options.inventory.browserBuildId;
      this.#executable = options.inventory.executable;
      this.#profile = paths.profile;
      this.#coordinator = options.coordinator;
      this.#maintenance = options.maintenance;
      this.#browserType = options.browserType;
      this.#observer = options.observer;
      this.#humanLoginActions = options.humanLoginActions;
    } catch { throw new BrowserFailure('PROFILE_OWNERSHIP_UNCONFIRMED'); }
  }

  async openBackground(input: BrowserOpenInput, guard: BrowserOpenGuard): Promise<BrowserProbeSession> {
    let parsed: BrowserOpenInput;
    try { parsed = browserOpenInputSchema.parse(input); }
    catch { throw new BrowserFailure('BROWSER_INPUT_INVALID'); }
    return this.#open(parsed, guard, true);
  }

  async openOfficialLogin(input: InteractiveLoginOpenInput, guard: BrowserOpenGuard): Promise<BrowserProbeSession> {
    let parsed: InteractiveLoginOpenInput;
    try { parsed = interactiveLoginOpenInputSchema.parse(input); }
    catch { throw new BrowserFailure('BROWSER_INPUT_INVALID'); }
    if (!this.#humanLoginActions) throw new BrowserFailure('BROWSER_HUMAN_ACTION_REQUIRED');
    try {
      const consumed = await this.#humanLoginActions.consume({
        actionReceiptId: parsed.actionReceiptId, source: parsed.source, approvedConfigId: parsed.approvedConfigId,
      });
      const exact = z.strictObject({
        authorized: z.literal(true), actionReceiptId: z.literal(parsed.actionReceiptId),
        source: z.literal(parsed.source), approvedConfigId: z.literal(parsed.approvedConfigId),
      }).parse(consumed);
      if (!exact.authorized) throw new Error('denied');
    } catch { throw new BrowserFailure('BROWSER_HUMAN_ACTION_REQUIRED'); }
    return this.#open(parsed, guard, false);
  }

  async #open(input: BrowserOpenInput, guard: BrowserOpenGuard, headless: boolean): Promise<BrowserProbeSession> {
    if (input.installationId !== this.#installationId || input.browserBuildId !== this.#browserBuildId ||
        input.generation !== guard.expectedGeneration) throw new BrowserFailure('BROWSER_INPUT_INVALID');
    await this.#assertOpenGuard(guard);
    let context: BrowserContext | undefined;
    let owner: ProfileOwnerIdentity | undefined;
    try {
      const reserved = await this.#coordinator.reserve({
        installationId: input.installationId, browserBuildId: input.browserBuildId,
        generation: input.generation, fence: input.fence,
      });
      if (reserved.resultCode !== 'PROFILE_RESERVED' || reserved.reservation === null) {
        throw new BrowserFailure(reserved.resultCode === 'PROFILE_IN_USE' ? 'PROFILE_IN_USE' : 'PROFILE_OWNERSHIP_UNCONFIRMED');
      }
      const before = await this.#observer.snapshot({
        browserBuildId: this.#browserBuildId, executable: this.#executable, workerPid: process.pid,
      });
      context = await (this.#browserType as BrowserType<ChromiumBrowser>).launchPersistentContext(this.#profile, {
        executablePath: this.#executable,
        headless,
        acceptDownloads: false,
        bypassCSP: false,
        serviceWorkers: 'block',
      });
      const after = await this.#observer.snapshot({
        browserBuildId: this.#browserBuildId, executable: this.#executable, workerPid: process.pid,
      });
      const prior = new Set(before.map(candidateKey));
      const candidates = after.filter(candidate => !prior.has(candidateKey(candidate)) && candidate.ownedByWorker &&
        candidate.browserBuildId === this.#browserBuildId && candidate.executable === this.#executable &&
        realpathSync(candidate.executable) === this.#executable && Number.isSafeInteger(candidate.pid) && candidate.pid > 0 &&
        candidate.osStartIdentity.length > 0 && candidate.startedAt.length > 0);
      if (candidates.length !== 1) throw new BrowserFailure('PROFILE_OWNERSHIP_UNCONFIRMED');
      const candidate = candidates[0]!;
      const attached = await this.#coordinator.attach(reserved.reservation, {
        pid: candidate.pid, osStartIdentity: candidate.osStartIdentity, executable: candidate.executable,
        startedAt: candidate.startedAt,
      });
      if (attached.resultCode !== 'PROFILE_OWNED' || attached.owner === null) throw new BrowserFailure('PROFILE_OWNERSHIP_UNCONFIRMED');
      owner = attached.owner;
      await this.#assertOwnerCurrent(owner, guard);
      const page = context.pages()[0] ?? await context.newPage();
      return await SealedBrowserProbeSession.create({
        context, page, owner, coordinator: this.#coordinator, maintenance: this.#maintenance,
        mode: headless ? 'background' : 'interactive',
        readOrigins: input.readOrigins,
        authenticationOrigins: input.authenticationOrigins,
      });
    } catch (error) {
      if (context) {
        try { await context.close(); } catch { /* Context ownership stays recorded when close is unconfirmed. */ }
      }
      if (owner) {
        try {
          const inspected = await this.#coordinator.inspect(owner);
          if (inspected.resultCode === 'PROFILE_CONFIRMED_EXITED') await this.#coordinator.release(owner);
          else if (!(error instanceof BrowserFailure)) {
            throw new BrowserFailure(inspected.resultCode === 'PROFILE_IN_USE' ? 'PROFILE_IN_USE' : 'PROFILE_OWNERSHIP_UNCONFIRMED');
          }
        } catch (cleanupError) {
          if (!(error instanceof BrowserFailure)) throw safeFailure(cleanupError, 'PROFILE_OWNERSHIP_UNCONFIRMED');
        }
      }
      throw safeFailure(error, 'PROFILE_OWNERSHIP_UNCONFIRMED');
    }
  }

  async #assertOpenGuard(guard: BrowserOpenGuard): Promise<void> {
    if (guard.signal.aborted) throw new BrowserFailure('BROWSER_ABORTED');
    const gate = await this.#maintenance.read();
    if (guard.signal.aborted) throw new BrowserFailure('BROWSER_ABORTED');
    if (gate.state !== 'open' || gate.generation !== guard.expectedGeneration) throw new BrowserFailure('BROWSER_FENCED');
  }

  async #assertOwnerCurrent(owner: ProfileOwnerIdentity, guard: BrowserOpenGuard): Promise<void> {
    await this.#assertOpenGuard(guard);
    const inspected = await this.#coordinator.inspect(owner);
    if (guard.signal.aborted) throw new BrowserFailure('BROWSER_ABORTED');
    if (inspected.resultCode !== 'PROFILE_IN_USE' || !sameOwner(inspected.owner, owner)) throw new BrowserFailure('BROWSER_FENCED');
  }
}
