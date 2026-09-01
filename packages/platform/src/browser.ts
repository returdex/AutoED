import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { z } from 'zod';
import type { BrowserContext, BrowserType, ChromiumBrowser, Page } from 'playwright';
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

  constructor(input: {
    context: BrowserContext;
    page: Page;
    owner: ProfileOwnerIdentity;
    coordinator: ProfileOwnershipCoordinator;
    maintenance: MaintenanceStore;
  }) {
    this.#context = input.context;
    this.#page = input.page;
    this.#owner = input.owner;
    this.#coordinator = input.coordinator;
    this.#maintenance = input.maintenance;
  }

  async navigate(_target: URL, _guard: BrowserRequestGuard): Promise<NavigationObservation> {
    throw new BrowserFailure('BROWSER_FENCED');
  }
  async waitFor(_locator: BrowserLocatorSpec, _guard: BrowserRequestGuard): Promise<'visible'> {
    throw new BrowserFailure('BROWSER_FENCED');
  }
  async readVisible(_locator: BrowserLocatorSpec, _guard: BrowserRequestGuard): Promise<string | null> {
    throw new BrowserFailure('BROWSER_FENCED');
  }
  async readAttribute(_locator: BrowserLocatorSpec, _attribute: string, _guard: BrowserRequestGuard): Promise<string | null> {
    throw new BrowserFailure('BROWSER_FENCED');
  }
  async close(_guard: BrowserRequestGuard): Promise<void> {
    await this.#context.close();
    const state = await this.#coordinator.inspect(this.#owner);
    if (state.resultCode === 'PROFILE_CONFIRMED_EXITED') { await this.#coordinator.release(this.#owner); return; }
    throw new BrowserFailure(state.resultCode === 'PROFILE_IN_USE' ? 'PROFILE_IN_USE' : 'PROFILE_OWNERSHIP_UNCONFIRMED');
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
      return new SealedBrowserProbeSession({ context, page, owner, coordinator: this.#coordinator, maintenance: this.#maintenance });
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
