---
phase: 01-beta
plan: "01"
subsystem: foundation
tags: [node24, openpgp, typescript, vitest, zod, synthetic]

requires: []
provides:
  - Managed Node 24.20.0 bootstrap with detached official-signature and artifact-hash verification
  - Exact root dependency lock, build identity inputs, and managed test/build commands
  - Owned synthetic test harness, evidence separation, and strict import-boundary checks
  - Strict domain schemas and application ports for jobs, maintenance, policy, processes, and status projections
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-10]

tech-stack:
  added: [Node 24.20.0, npm 11.19.0, TypeScript 7.0.2, Vitest 4.1.11, Zod 4.4.3, Playwright 1.62.1, Fastify 5.12.1, better-sqlite3 13.0.3, MCP SDK 2.0.0, OpenPGP.js 6.3.1 bootstrap verifier]
  patterns: [managed signed runtime, strict boundary schemas, expected-generation write fencing, S-I-N-L evidence separation]

key-files:
  created: [package.json, package-lock.json, scripts/dev/runtime.mjs, scripts/build/build.mjs, vitest.config.ts, playwright.config.ts, packages/domain/src/model.ts, packages/contracts/src/index.ts, packages/application/src/ports.ts, packages/test-support/src/harness.ts]
  modified: [.gitignore]

key-decisions:
  - "OpenPGP.js 6.3.1 is isolated under ignored .runtime/dev-toolchain/verifier and never enters product dependencies or beta artifacts."
  - "Node bootstrap accepts only an official detached signature by a pinned primary release-key fingerprint, then matches the target archive against the signed checksum bytes."
  - "Application write authority is supplied out of band as expectedGeneration plus an optional operation-bound selfcheck context; normal request schemas reject those fields."
  - "No application entry-point success is claimed in this foundation plan; the verified build correctly reported zero entries pending later plans."

patterns-established:
  - "Unknown observations stay null/not_observed, while auth, capability, health, freshness, completeness and outcome remain independent."
  - "MCP transitive boundary checks reject persistence, Profile, platform drivers and direct filesystem/process modules, except narrow future credential/discovery adapters."

requirements-completed: []
requirements-referenced: [PLAT-01, ARCH-02, DIST-01]

duration: 12min
completed: 2026-08-27
---

# Phase 1 Plan 1: Managed Runtime, Test Foundation and Shared Contracts Summary

**Authenticated Node 24 toolchain with exact dependency locking, tamper-negative bootstrap tests, owned synthetic test infrastructure and generation-fenced application contracts.**

## Performance

- **Duration:** approximately 12 minutes after verifier approval
- **Started:** 2026-08-27 01:18 AEST
- **Completed:** 2026-08-27 01:30 AEST
- **Tasks:** 3/3
- **Files created/modified:** 15 tracked implementation/config/test files plus this summary

## Accomplishments

- Verified the pinned `openpgp@6.3.1` tarball integrity, used detached OpenPGP verification over the exact official `SHASUMS256.txt` bytes, matched signer key ID `20b1a390b168d356` to pinned full fingerprint `5BE8A3F6C8A5C01D106C0AD820B1A390B168D356`, matched Node archive SHA-256 `40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8`, and only then executed Node `v24.20.0`.
- Installed the exact approved dependency set with lifecycle scripts and Playwright browser download disabled; two consecutive `npm ci` operations left the managed runtime intact.
- Ran 20 unit tests, including wrong-key, changed-checksum, changed-archive, verifier-integrity, symlink, all-skipped evidence and transitive import negatives.
- Defined strict synthetic scope, rights, status, build identity, maintenance, projection and JobStore/application port contracts for direct implementation by Plans 02 and 03.

## Task Commits

1. **Task 01-1: managed Node and build configuration** — `29899c8`
2. **Task 01-2 RED: bootstrap/harness safety behavior** — `d93f17d`
3. **Task 01-2 GREEN: synthetic harness and verification negatives** — `09315ad`
4. **Task 01-3 RED: strict contracts and import boundaries** — `f2841d4`
5. **Task 01-2 evidence follow-up: reject all-skipped runs** — `f2192a1`
6. **Task 01-3 GREEN: contracts and application ports** — `cca53d5`
7. **Task 01-3 boundary follow-up: direct MCP driver packages** — `20389f5`

## Verification Evidence

| Evidence | Platform | Result |
|---|---|---|
| `node scripts/dev/runtime.mjs --check` | macOS 26.5.2 arm64, managed Node 24.20.0 | pass |
| `npm ci` twice with ignored lifecycle scripts | macOS 26.5.2 arm64 | pass |
| full unit suite | S, macOS arm64, managed Node 24.20.0 | 20/20 pass; 3 files |
| `npm run typecheck` | automated compiler check, macOS arm64, TypeScript 7.0.2 | pass |
| `npm run build` | automated build check, macOS arm64 | pass; zero app entries accurately reported |
| native Windows x64 execution | N, Windows 11 x64 | not_run |
| live/school/Profile behavior | L | not_run and out of Plan 01 scope |

## Files Created/Modified

- `scripts/dev/runtime.mjs` — isolated verifier, official key/signature/archive checks and managed command runner.
- `scripts/build/build.mjs` — canonical build-input hashing and a single compiled build identity.
- `packages/test-support/src/harness.ts` — synthetic roots, owned process cleanup, loopback allowlist and evidence records.
- `packages/domain/src/model.ts` — pure state, scope, projection and process contracts.
- `packages/contracts/src/index.ts` — strict Zod schemas that reject arbitrary browser and privileged maintenance fields.
- `packages/application/src/ports.ts` — direct downstream interfaces with generation/operation/fence controls.
- `tests/unit/*.test.ts` — executable supply-chain, contract and transitive-boundary checks.

## Decisions Made

- Followed the separately approved bootstrap amendment without a checksum-only fallback, custom cryptography, global GPG installation, or production OpenPGP dependency.
- Used a content hash of canonical selected build inputs, including untracked sources, so differing build inputs cannot silently share an identity.
- Kept accepted phase requirements pending: this plan supplies foundational evidence but does not prove phase-wide native/product behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped root build ignores**
- **Found during:** Task 01-1 commit
- **Issue:** The existing `build/` ignore pattern also ignored tracked source path `scripts/build/`.
- **Fix:** Scoped generated output ignores to `/build/` and `/dist/`.
- **Files modified:** `.gitignore`
- **Verification:** `scripts/build/build.mjs` staged normally; root build output remains ignored.
- **Committed in:** `29899c8`

**2. [Rule 2 - Security] Hardened approved verifier bootstrap cache boundaries**
- **Found during:** Task 01-1 review
- **Issue:** Existing cache symlinks could otherwise redirect writes or extraction outside the ignored verifier/runtime tree; Windows path separators needed explicit handling.
- **Fix:** Reject non-regular cache destinations, dangling/external links and non-owned path ancestors on both platforms; accept only Node's internal extraction links.
- **Files modified:** `scripts/dev/runtime.mjs`
- **Verification:** Symlink rejection test plus full bootstrap re-verification.
- **Committed in:** `09315ad`

**3. [Rule 2 - Evidence integrity] Failed empty/all-skipped test runs**
- **Found during:** Task 01-2 verification
- **Issue:** `passWithNoTests:false` rejects empty collections but does not itself reject an all-skipped collection.
- **Fix:** Added a reporter gate and an actual nested Vitest process proving all-skipped exit status 1.
- **Files modified:** `vitest.config.ts`, `tests/unit/bootstrap.test.ts`
- **Verification:** Full unit suite includes the nested-process behavior assertion.
- **Committed in:** `f2192a1`

**Total deviations:** 3 auto-fixed (one blocking, two security/evidence correctness). No architectural or scope changes.

## Issues Encountered

- The approved signature verifier was absent at initial execution. The separately approved OpenPGP.js amendment resolved this hard prerequisite before implementation.
- OpenPGP.js advisory `GHSA-8qff-qr5q-5pr8` affects versions through 6.1.0 and is fixed in 6.1.1; pinned 6.3.1 is later. The implemented path additionally uses detached verification, which the advisory describes as unaffected. This is a scoped advisory review, not a claim that every advisory was cleared forever.

## Known Stubs

None. Null/not-observed projection values are intentional domain states, not unwired UI data. Application entry points are owned by later approved plans and this build explicitly reports their current absence.

## Threat Flags

No unplanned trust boundary was added. Network access is the plan-approved bootstrap path to fixed HTTPS Node, npm registry and immutable Node release-key sources. Test harness network access is loopback-only.

## User Setup Required

None. No official login, MFA, Profile, school access, OS permission or release-key custody action occurred.

## Next Plan Readiness

Plan 01-02 can implement `JobStore`, `MaintenanceStore`, and `StatusProjectionStore` against the exact exported signatures. Windows native evidence remains `not_run`; it must not be replaced with macOS, synthetic or WSL evidence.

## Self-Check: PASSED

Verified all 15 implementation/config/test files exist, all seven task commit hashes resolve to commit objects, and `git diff --check` passes. No tracked files were deleted. Shared STATE/ROADMAP/REQUIREMENTS updates remain owned by the orchestrator.

---
*Phase: 01-beta*
*Completed: 2026-08-27*
