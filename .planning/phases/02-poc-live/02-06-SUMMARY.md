---
phase: 02-poc-live
plan: "06"
subsystem: source-adapters
tags: [sealed-adapters, browser-fencing, origin-containment, synthetic-fixtures, privacy]
requires:
  - phase: 02-poc-live
    plan: "01"
    provides: strict source request/result/config contracts and sealed SourceProbePort
  - phase: 02-poc-live
    plan: "05"
    provides: bounded Local Playwright session and per-operation ownership/generation fences
provides:
  - four-action Moodle/EdStem source adapter registry with configuration and origin-hop admission
  - source-specific positive-marker, stable-identity and one-scope visibility projections
  - synthetic-only hostile page fixture with zero-network and zero-side-effect audit counters
affects: [02-07 auth worker, 02-08 paired auth API, AUTH-01, AUTH-03, SEC-02]
tech-stack:
  added: []
  patterns: [session-minted exact-owner guard, static source descriptors, bounded visible projections, strict safe-code mapping]
key-files:
  created:
    - packages/platform/src/source-adapters.ts
    - tests/integration/source-adapters.test.ts
  modified:
    - packages/platform/src/browser.ts
    - packages/test-support/src/auth-fixture.ts
    - .planning/phases/02-poc-live/deferred-items.md
key-decisions:
  - "The attached browser session mints its own exact-owner request guard; adapters and upstream callers cannot supply or replace Profile ownership identity."
  - "Source descriptors are fixed and source-specific; missing, ambiguous or unsupported visible markers fail as parser drift rather than falling back to URL reachability or an internal API."
  - "Automated adapter fixtures remain in-memory S/I evidence only; they cannot create native/live receipts or alter Windows and Phase 3 gates."
patterns-established:
  - "Admission before browser: strict request, confirmed config, exact source/config/scope and normalized origin must all pass before openBackground."
  - "Evidence before auth: official-origin navigation plus one bounded source marker is required before stable identity or approved-course visibility is read."
requirements-completed: []
duration: 12min
completed: 2026-09-01
---

# Phase 2 Plan 06: Sealed Source Adapters Summary

**Four fixed Moodle/EdStem probes now derive bounded targets from confirmed configuration, enforce every official-origin hop, and return only source-specific marker, fingerprint and one-scope visibility evidence from synthetic-contained tests.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-01T04:50:56Z
- **Completed:** 2026-09-01T05:03:18Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 5 source/test/tracking files

## Accomplishments

- Implemented `SealedSourceAdapters implements SourceProbePort` with exactly four source-matched actions, strict extra-key rejection, confirmed config/scope checks and no caller URL, script, selector, method, body, download or write surface.
- Enforced exact normalized official origin for the initial target, every redirect observation and the final page before any marker or identity read.
- Required bounded source-specific visible markers before `AUTHENTICATED`; login, parser, network, capability, interaction, cancellation and fence outcomes remain distinct safe results.
- Returned only hashed stable subject/organization/tenant evidence and a single approved-scope visibility state; no display hint, content, post, file or grade value crosses the adapter result.
- Added a synthetic-only malicious fixture covering same-origin redirects, cross-origin escape, marker drift, identity gaps/conflicts, course states and blocked popup/download/write/API effects without DNS, real browser, source mutation or capture output.

## Task Commits

Each task followed RED then GREEN and was committed atomically:

1. **Task 1 RED: sealed actions, approved config, origin and containment** — `b6c82b5` (test)
2. **Task 1 GREEN: sealed dispatch and official-origin enforcement** — `f82e8d1` (feat)
3. **Task 2 RED: bounded markers, identity, visibility and malicious effects** — `e563df3` (test)
4. **Task 2 GREEN: strict evidence and cancellation/fence outcomes** — `a9144c5` (feat)

No separate REFACTOR commit was necessary; the GREEN implementation already isolates configuration admission, safe-code projection, marker parsing, identity projection and course visibility as bounded private helpers.

## Files Created/Modified

- `packages/platform/src/source-adapters.ts` — Four-action registry, config/origin admission, bounded marker/identity/visibility reads and strict result projection.
- `packages/platform/src/browser.ts` — Session-issued exact-owner guard plus safe network/ambiguous-output classification required by the adapter boundary.
- `packages/test-support/src/auth-fixture.ts` — In-memory dual-source positive/hostile session fixture and sanitized audit counters fixed to S/I.
- `tests/integration/source-adapters.test.ts` — 63 admission, origin, marker, identity, visibility, side-effect, privacy and cancellation/fence cases.
- `.planning/phases/02-poc-live/deferred-items.md` — Records the known installed-service full-suite conflict without stopping that service.

## Verification

- Managed focused adapter suite: **63/63 passed**.
- Adapter plus BrowserProvider regression: **104/104 passed**.
- Auth-contract and transitive import-boundary regression: **30/30 passed**.
- `npm run typecheck`: **passed**.
- Forbidden capability scan over the adapter: **zero matches** for script/DOM execution, storage/cookie access, HTTP client fallback, raw page/context use, form submission, fill or click surfaces.
- Export scan: only `SealedSourceAdapters` is exported from the adapter file; no locator, navigation, guard, session or URL-builder type is exported there.
- Fixture audit: external/source request count, non-GET/HEAD success, downloaded bytes, popup interaction, API fallback access and source mutation are all **zero**.
- Repository-wide integration attempt: **208/248 passed**. Forty failures are the already documented fixed-port installation/runtime cascade plus the existing isolated SQLite-busy timing case; no Plan 02-06 focused test failed.

All new adapter results are synthetic S/I evidence. No real source, account, official login, persistent Profile content, course content, publication, native result or live receipt was accessed or created.

## Decisions Made

- Kept browser ownership private to the attached session. The adapter receives a session-issued guard carrying the exact owner instead of accepting a caller-provided owner or exporting an owner getter.
- Used static source-specific descriptors and exact bounded marker values. Actual source support remains unvalidated; an unsupported or changed page returns `PARSER_CHANGED` rather than a guessed endpoint, URL/200 success or API fallback.
- Kept display name and school email out of `SourceProbeResult`; only bounded stable-evidence fingerprints are returned for later application binding decisions. Missing stable evidence leaves identity null and course access blocked for later human confirmation.
- Preserved Phase 1 partial status, Windows `not_run / human_needed`, Phase 2 live/native gaps and the Phase 3 hard block. AUTH-01, AUTH-03 and SEC-02 remain Pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a session-issued exact-owner request guard**
- **Found during:** Task 1 GREEN
- **Issue:** The existing session required a complete owner-bearing request guard but exposed no safe way for the adapter to obtain the owner attached during browser launch. Supplying it from the adapter constructor would have violated the ownership boundary.
- **Fix:** Added `requestGuard(signal, expectedGeneration)` on the sealed session; it rejects a generation mismatch and mints the guard from the private attached owner.
- **Files modified:** `packages/platform/src/browser.ts`, `packages/platform/src/source-adapters.ts`
- **Verification:** BrowserProvider plus adapter regression passes 104/104; wrong-owner guard count remains zero.
- **Committed in:** `f82e8d1`

**2. [Rule 2 - Missing Critical Functionality] Distinguished network and ambiguous locator outcomes**
- **Found during:** Task 1 GREEN
- **Issue:** Navigation failures and missing/multiple locator observations could otherwise collapse into a generic fence result, preventing the adapter from keeping network failure separate from parser drift.
- **Fix:** Added safe network and ambiguous-output codes and exact zero/one locator cardinality handling before bounded reads.
- **Files modified:** `packages/platform/src/browser.ts`, `packages/platform/src/source-adapters.ts`
- **Verification:** Marker/network matrix and the prior BrowserProvider suite pass; the adapter forbidden-capability scan remains empty.
- **Committed in:** `f82e8d1`

**3. [Rule 1 - Bug] Prevented parser or close-fence failures from retaining authenticated evidence**
- **Found during:** Task 2 RED/GREEN
- **Issue:** Oversized identity evidence and cancellation/fence failure during final close could retain an authenticated projection even though the bounded probe did not finish safely.
- **Fix:** Parser failures now clear authenticated status, and a close/cancellation failure downgrades a would-be success without overriding an earlier primary safety failure.
- **Files modified:** `packages/platform/src/source-adapters.ts`, `packages/test-support/src/auth-fixture.ts`, `tests/integration/source-adapters.test.ts`
- **Verification:** The RED suite failed on all three unsafe cases; GREEN passes all 63 adapter cases.
- **Committed in:** `a9144c5`

---

**Total deviations:** 3 auto-fixed (1 blocking dependency, 1 missing critical classification, 1 correctness bug). **Impact:** Each change closes a required T2-01/T2-03 safety path without adding source access, interaction, content, publication or live-evidence authority.

The generic requirement-completion update was intentionally not applied. AGENTS.md and the approved validation strategy require AUTH-01, AUTH-03 and SEC-02 to remain Pending until their complete S/I/L evidence exists.

## Issues Encountered

- The healthy installed Phase 1 API owns fixed loopback port `43187`. Per project instructions it was not stopped or altered for the repository-wide integration run. The known port conflict and unrelated SQLite-busy timing case remain in `deferred-items.md`; all Plan 02-06 focused checks pass.

## Known Stubs

None. Static source descriptors intentionally fail closed until actual approved-origin support is established; this is a source-support/live gate, not a data or UI stub.

## Threat Flags

None. The adapter/browser surfaces are the exact T2-01, T2-01-OUTPUT and T2-03 boundaries registered and mitigated by this plan; no new endpoint, schema, file-access or unregistered network surface was introduced.

## Authentication Gates

None. This plan did not perform official login, request credentials, open a real source or create a live action.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-07 can compose the sealed adapter behind durable auth jobs and worker fences.
- Source-specific supportability, actual official origins/account/scope and every native/live scenario remain future hard gates; fixture success cannot substitute for them.
- Windows remains `not_run / human_needed`; Phase 1 remains partial, Phase 2 is not globally passed and Phase 3 remains blocked.

## Self-Check: PASSED

All created and modified plan files exist; RED/GREEN commits `b6c82b5`, `f82e8d1`, `e563df3` and `a9144c5` are present in order; focused adapter/browser, contract-boundary and typecheck verification passed; and `git diff --check` reported no whitespace errors.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
