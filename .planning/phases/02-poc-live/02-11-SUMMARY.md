---
phase: 02-poc-live
plan: "11"
subsystem: synthetic-auth-browser-e2e
tags: [playwright, chromium, sqlite, fastify, auth-jobs, source-adapters, paired-ui, evidence-gates]
requires:
  - phase: 02-poc-live
    plans: ["02", "06", "07", "08", "09", "10", "12", "35"]
    provides: durable auth stores/jobs, sealed adapters, paired API, built status UI, security matrix, beta boundary
provides:
  - fully local two-browser auth E2E composition using actual SQLite, durable jobs, sealed adapters, paired Fastify API and built UI assets
  - browser-observed Moodle-to-EdStem ordering, approved-origin/positive-marker gates, candidate confirmation, confirmed drift and cancellation fencing
  - protected UI purge/stale/privacy, append-only S receipt isolation, Windows/Phase 3 hard gates, keyboard, zoom and narrow-layout regression
  - evidence-derived binding coordinator with API-only human confirmation and correct same-observation SQLite confirmation semantics
affects: [02-12 beta release, 02-14 live UAT, Phase 3 gate, AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01]
tech-stack:
  added: []
  patterns: [independent source and UI Chromium, route-fulfilled synthetic origins, durable runner pump, paired HTTP-only UI, teardown audit]
key-files:
  created:
    - packages/test-support/src/auth-e2e.ts
    - tests/ui/auth-e2e.spec.ts
  modified:
    - packages/application/src/auth.ts
    - packages/persistence/src/auth.ts
    - tests/integration/auth-persistence.test.ts
key-decisions:
  - "Synthetic redirects use browser-executed location.replace hops because Chromium cannot follow a route-fulfilled 302 to a deliberately unresolved hostname without DNS or host-file changes."
  - "EdStem uses route-fulfilled synthetic.edstem.org because the production source-admission schema correctly rejects non-EdStem hosts; the hostname is never resolved or contacted."
  - "Evidence-derived candidate and drift persistence belongs in an application coordinator; only the paired API/UI may convert a candidate to confirmed."
patterns-established:
  - "Every E2E fixture owns a protected temporary root, SQLite database, ephemeral API, runner, source browser and UI browser and proves teardown before returning."
  - "Browser request audit stores only source/action/method/origin/classification counters, never bodies, headers, page dumps, credentials, screenshots, traces, video or HAR."
requirements-completed: []
duration: 49min
completed: 2026-09-01
---

# Phase 2 Plan 11: Fully Local Synthetic Browser/Auth UI E2E Summary

**Independent Chromium source and paired-UI browsers now drive the actual SQLite → durable AuthJobRunner → sealed adapter → Fastify API → built status UI path while proving fail-closed origins, binding drift, cancellation, protected-data cleanup and unchanged native/live gates.**

## Performance

- **Duration:** 49 min
- **Started:** 2026-09-01T07:27:40Z
- **Completed:** 2026-09-01T08:16:33Z
- **Tasks:** 2 TDD tasks plus two production correctness corrections
- **Files modified:** 5 source/test files

## Accomplishments

- Added `createSyntheticAuthE2E()` with a fresh protected managed root, actual SQLite auth stores and evidence ledger, `AuthJobService`/`AuthJobRunner`, `SealedSourceAdapters`, built status assets, actual Fastify pairing and two independently launched Chromium instances.
- Exercised direct and browser-observed 1–3-hop Moodle navigation, missing/ambiguous markers, cross-origin final navigation and interaction-required failure; EdStem never starts after a failed Moodle gate.
- Proved actual UI pairing and Moodle-before-EdStem progression, durable observations, evidence-derived candidate creation, opaque paired confirmation, approved course visibility and confirmed-identity drift with course access blocked.
- Proved repeat activation enqueues one job and a read-barrier cancellation cannot publish a late observation; teardown derives the post-cancel commit count from SQLite rather than a canned counter.
- Audited protected identity sentinels across visible/forbidden surfaces, cleared protected state on actual 401/403 read failures, retained visibly stale state on 5xx, and kept forbidden attributes/live regions/storage/URL/console free of the sentinels.
- Appended only synthetic `S` receipts through the real ledger, retained both append-only rows, displayed the 24-hour wait and exact Windows/Phase 3 blocking text, and never created N/L/Windows evidence.
- Verified 1280/759/599/320 widths, 200% zoom, 48px controls, no horizontal overflow, keyboard focus and refresh focus restoration without screenshots.
- Fixed exact candidate confirmation in SQLite so the human decision may preserve its source-observation timestamp while all unrelated equal/older writes remain stale.
- Added `IdentityBindingCoordinator` so candidate/mismatch rows are derived from real source evidence while confirmed state remains exclusively produced by the paired confirmation API.

## Task Commits

1. **Plan RED: failing synthetic browser/UI scenarios** — `2b5126b` (test)
2. **Rule 1 correction: exact candidate confirmation** — `afba686` (fix)
3. **Task 1 GREEN: local dual-browser auth composition** — `303046a` (feat)
4. **Task 2 GREEN: protected UI, evidence and responsive gates** — `7ba8706` (test)
5. **Rule 2 correction: evidence-derived binding coordination** — `ba9f388` (feat)

No separate REFACTOR commit was needed.

## Files Created/Modified

- `packages/test-support/src/auth-e2e.ts` — Fully local API/SQLite/runner/adapter/source-browser/UI-browser harness, strict synthetic router, request/surface/evidence audits, failure injection and complete teardown.
- `tests/ui/auth-e2e.spec.ts` — Eight named real-browser scenarios covering containment, origin/marker gates, ordering, binding/drift, cancellation, protected purge/stale state, evidence gates and accessibility/layout.
- `packages/application/src/auth.ts` — Evidence-derived candidate/drift coordinator that cannot manufacture confirmed state.
- `packages/persistence/src/auth.ts` — Exact-candidate confirmation accepts the original observation timestamp without weakening stale-write rejection.
- `tests/integration/auth-persistence.test.ts` — Regression for same-observation candidate-to-confirmed persistence.

## Verification

- Plan Task 1 grep: **5/5 passed**, followed by typecheck.
- Plan Task 2 grep: **3/3 passed**, followed by typecheck.
- Existing paired/real-browser/keyboard grep: **3/3 passed**.
- Full Playwright UI regression: **30/30 passed**.
- Focused auth contract/state/output-policy unit regression: **67/67 passed**; final auth-state rerun **31/31 passed**.
- Focused adapter/Worker/API/persistence integration regression: **104/104 passed**.
- Static capture gate: no `page.screenshot`, snapshot, enabled trace or enabled video references in the new harness/spec; config remains screenshot/trace/video off.
- Final process/root/artifact audit: no Playwright process, harness Chromium, E2E Node process, recent managed temp root or `test-results` file remained.
- Installed service, real runtime, real Profile, official login, school source, publication and native/live evidence were untouched.

## Decisions Made

- Kept the source browser direct with a deny-by-default route handler and the UI browser behind the existing closed loopback proxy; both contexts block service workers/downloads and map only their explicit synthetic or loopback origins.
- Used browser-executed same-origin `location.replace` chains for synthetic redirect coverage. Route-fulfilled 302 redirects require hostname resolution before the next interception in Chromium, which would violate the no-DNS/no-host-file boundary.
- Preserved the production EdStem admission rule instead of weakening it for tests. `synthetic.edstem.org` is route-fulfilled in memory and never placed in a proxy bypass or resolved.
- Kept confirmation authority separate: the coordinator may persist candidate or proven drift only; the test confirms through the built UI and paired API using the opaque candidate ID.
- Kept AUTH-01–AUTH-04, SEC-02 and UAT-01 Pending. All results are synthetic/integration evidence and cannot satisfy official login, native platform, cross-day live or Windows gates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unresolved-host 302 fixtures with observed browser client redirects**
- **Found during:** Task 1 origin/marker GREEN run
- **Issue:** Chromium fulfilled the initial synthetic HTTPS response but attempted DNS/proxy resolution before intercepting a 302 destination on the deliberately unresolved host.
- **Fix:** Synthetic pages now perform bounded `location.replace` hops. Each hop is an actual browser navigation observed and fulfilled by the deny-by-default router; no DNS, host resolver rule, hosts-file edit or external socket is used.
- **Files modified:** `packages/test-support/src/auth-e2e.ts`
- **Verification:** Origin/marker matrix and full UI suite pass with zero school/external request counters.
- **Committed in:** `303046a`

**2. [Rule 3 - Blocking] Separated request-throttle time from source-observation time**
- **Found during:** Task 1 paired UI progression
- **Issue:** Reusing the millisecond source clock for clustered browser API calls legitimately activated the production request limiter and made later status reads stale/error.
- **Fix:** Kept source/evidence timestamps deterministic while advancing a distinct injected request-limit clock by 60,001ms per request, matching existing UI integration fixtures.
- **Files modified:** `packages/test-support/src/auth-e2e.ts`
- **Verification:** Moodle→EdStem UI progression passes through the actual paired API.
- **Committed in:** `303046a`

**3. [Rule 1 - Bug] Allowed exact candidate confirmation without inventing a new source timestamp**
- **Found during:** Task 1 paired binding confirmation
- **Issue:** The API correctly copied the candidate evidence into confirmed state, but SQLite rejected the unchanged evidence timestamp as stale.
- **Fix:** Added the narrowly defined candidate→confirmed same-observation exception while retaining stale rejection for every other equal/older write.
- **Files modified:** `packages/persistence/src/auth.ts`, `tests/integration/auth-persistence.test.ts`
- **Verification:** Persistence 16/16, binding E2E and all focused integration regressions pass.
- **Committed in:** `afba686`

**4. [Rule 2 - Missing Critical Functionality] Added evidence-derived binding coordination**
- **Found during:** Task 1 acceptance audit
- **Issue:** The durable runner and sealed adapters produced independent source evidence, but no application service persisted the cross-source candidate or confirmed drift without test code writing the store directly.
- **Fix:** Added `IdentityBindingCoordinator`; the harness supplies only real sealed-adapter evidence, and confirmed state is still created solely by the paired API/UI action.
- **Files modified:** `packages/application/src/auth.ts`, `packages/test-support/src/auth-e2e.ts`
- **Verification:** No direct observation/binding success writes, presenter calls or DOM injection remain in the harness; binding/drift E2E and full regressions pass.
- **Committed in:** `ba9f388`

**5. [Rule 3 - Compatibility] Used a source-admitted synthetic EdStem hostname**
- **Found during:** Task 1 configuration setup
- **Issue:** The plan's literal second `.invalid` hostname conflicts with the approved production schema, which admits only `edstem.org` or its subdomains for EdStem.
- **Fix:** Used `https://synthetic.edstem.org`, fulfilled exclusively in the source browser router and never resolved or contacted. Moodle remains on `.invalid`.
- **Files modified:** `packages/test-support/src/auth-e2e.ts`
- **Verification:** Request audit and final process/network containment checks remain zero.
- **Committed in:** `303046a`

---

**Total deviations:** 5 auto-fixed (1 production bug, 1 missing application coordinator, 3 blocking/compatibility harness corrections). **Impact:** The approved trust boundaries and hard gates were preserved; no real source, credential, Profile, platform, publication or evidence authority was added.

## Issues Encountered

- Route-fulfilled 302s to unresolved names are not a usable zero-DNS redirect fixture in this Chromium build. Browser-executed redirect pages provide the same observed navigation boundary without weakening containment.
- A paired UI page must not be reloaded merely to refresh projections because its CSRF value is intentionally memory-only; the harness uses the actual refresh control and verifies focus restoration.

## Known Stubs

None. Empty request/audit accumulators, nullable cancel snapshots and default options are bounded test state, not UI or production-data placeholders. Windows/N/L cells, `not_run`, `human_needed`, unverified Profile/live state and blocked Phase 3 are required honest gate states.

## Threat Flags

None. The application coordinator writes only through the existing binding store and exposes no new endpoint, source operation, credential path, Profile path, schema or external network surface. All new browser/API surfaces are test-only and ephemeral.

## Authentication Gates

None. No official page was opened and no password, MFA, credential, real session or live action was requested or synthesized.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-12 beta work may consume the now-green synthetic E2E evidence, but this does not imply live authentication or native verification passed.
- Windows remains `not_run / human_needed`; N/L evidence remains absent; Phase 3 remains blocked.
- Shared `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` tracking is intentionally left to the wave orchestrator; no requirement was marked complete by this S/I-only plan.

## Self-Check: PASSED

All five listed source/test files and this SUMMARY exist; commits `2b5126b`, `afba686`, `303046a`, `7ba8706` and `ba9f388` are present in order. Typecheck, both plan greps, full 30-test UI regression, focused 67-test unit regression and focused 104-test integration regression pass. Static capture, stub, process, temporary-root and browser-artifact scans are clean.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
