---
phase: 02-poc-live
plan: "36"
subsystem: paired-live-checkpoints
tags: [fastify, sqlite, paired-ui, durable-actions, live-evidence, csrf]
requires:
  - phase: 02-poc-live
    plan: "08"
    provides: paired auth routes and restart-revoked ordinary login correlations
  - phase: 02-poc-live
    plan: "09"
    provides: protected auth status projection and paired checkpoint ledger UI
  - phase: 02-poc-live
    plan: "11"
    provides: evidence-derived binding state and protected browser UI patterns
  - phase: 02-poc-live
    plan: "35"
    provides: durable live actions, exact L-cell registry and transactional consume-and-append store
provides:
  - closed paired-server workflows for all eleven live scenarios on macOS and Windows
  - fixed issue/resume/result API routes with durable server-held authority and production runtime checks
  - protected status UI controls with memory-only action correlations and durable recovery
affects: [02-37 through 02-41, AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01, Phase 3 gate]
tech-stack:
  added: []
  patterns: [fixed scenario dispatch, server-projected recovery, payload-external human authority, memory-only UI correlation]
key-files:
  created:
    - tests/integration/live-checkpoint-workflows.test.ts
    - tests/ui/auth-live-actions.spec.ts
  modified:
    - packages/application/src/live-checkpoints.ts
    - packages/persistence/src/auth.ts
    - apps/api/src/auth.ts
    - apps/api/src/main.ts
    - apps/status/src/main.ts
key-decisions:
  - "Only fixed scenario-specific paired routes can reach live workflow methods; no caller selects an operation, evidence cell, platform, source or writer authority."
  - "Status projections disclose that an action is pending but not its opaque IDs; a newly paired UI recovers IDs only through the fixed scenario resume route."
  - "A completed acknowledgement is never sufficient for pass: production runtime state must independently confirm the bounded source or lifecycle observation after issuance."
patterns-established:
  - "Paired live bundle: issue one durable child per missing source, retain partial progress, and transactionally consume each exact child once."
  - "Protected live UI: render server-owned platform/scenario/instruction/time state, keep IDs only in module memory, and purge on authorization loss."
requirements-completed: []
duration: 27min
completed: 2026-09-01
---

# Phase 2 Plan 36: Paired Durable Live Action Workflows Summary

**The production paired server and protected status UI now drive all eleven durable live-checkpoint workflows through fixed routes, server-verified runtime state and one-time exact-cell appends without creating any live result during this execution.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-01T08:19:11Z
- **Completed:** 2026-09-01T08:46:07Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 7 production/test files plus this summary

## Accomplishments

- Added a closed workflow registry for A1 login; A2 binding and course visibility; B1 reopen rounds 1–3; B2 Worker restart; B3 Codex exit; C OS restart; D 24-hour recheck; and reauth, independently on macOS and Windows for Moodle and EdStem.
- Composed the durable SQLite live-action store, protected installation authority and production runtime into the standalone paired API. Strict fixed issue/resume/result routes reject caller-selected operations, cells, source/platform values, browser instructions and authority fields.
- Required current immutable build, installation, configuration, scope, binding, generation, predecessor, Profile-ownership state and bounded post-issue observations before an exact action can append L.
- Added one primary scenario-bound status UI action, fixed failure/human-needed controls, server-owned instructions and D timing, memory-only action IDs, authorization purge and re-pair/resume recovery.
- Preserved partial paired progress: if one source child completes before the other, the remaining child is still resumable and no consumed child is replayed.

## Evidence Boundary

- **Evidence created by this plan:** synthetic integration and browser-test results only.
- **Live evidence:** no real L pass, auto-approval or installed-runtime receipt was created. All action/evidence writes used temporary synthetic test databases that were cleaned by their harnesses.
- **Not accessed:** no official login, MFA, school source, course content, credential, sensitive Profile, publication, release tag or installed-service mutation.
- **Preserved gates:** Windows remains `not_run / human_needed`; required live cells remain unrun/human-needed; Phase 1 remains partial; requirements remain Pending; Phase 3 remains blocked.

## Action Workflow Coverage

- The workflow table and fixed API route table contain exactly the same eleven scenario slugs, each with explicit issue, resume and result methods; both native platforms and both approved sources are covered.
- Issue verifies the exact predecessor and server runtime binding, creates only missing source children, and enforces D from server time.
- Resume accepts only `{}` and reloads current unexpired actions from durable state after a fresh paired session; status never returns their IDs.
- Result accepts only `{ actionId, acknowledgement }`, revalidates action/runtime bindings, observes bounded server state before authority resolution, records failure/human-needed without inferred pass, and consumes/appends once transactionally.
- Replay, wrong scenario/action, build or generation drift, forbidden request fields and an ordinary login correlation all fail closed in synthetic integration coverage.

## Task Commits

1. **Task 1 RED: paired workflow and API contracts** — `cd9426d` (test)
2. **Task 1 GREEN: durable production paired workflows** — `ad89030` (feat)
3. **Task 2 RED: protected live action UI behavior** — `57a8811` (test)
4. **Task 2 GREEN: scenario-bound controls and recovery** — `47e54bb` (feat)

## Files Created/Modified

- `packages/application/src/live-checkpoints.ts` — closed scenario table, explicit service methods, predecessor/time gates, durable recovery and post-observation exact result handling.
- `packages/persistence/src/auth.ts` — exact pending-action enumeration and latest exact-cell outcome lookup used for restart recovery and predecessor resolution.
- `apps/api/src/auth.ts` — protected installation authority and 33 strict scenario-specific issue/resume/result routes plus protected status.
- `apps/api/src/main.ts` — production runtime validation and standalone composition of the live store, authority and paired service.
- `apps/status/src/main.ts` — fixed server-projected instructions/actions, active-platform ledger, memory-only correlations, durable resume and privacy purge.
- `tests/integration/live-checkpoint-workflows.test.ts` — workflow table, predecessor, authority ordering, failure, correction, replay, recovery, drift and paired-route tests.
- `tests/ui/auth-live-actions.spec.ts` — fixed-body controls, re-paired recovery, payload-external privacy and platform/D-gate tests.

## Verification

- Managed Node 24.20.0 TypeScript typecheck: **passed**.
- Focused workflow/store/API integration surface: **29/29 passed**.
- Focused durable-action Playwright surface: **4/4 passed**.
- Full Playwright regression: **34/34 passed**.
- Managed production build: **passed**, with four actual application entries built and no release or tag created.
- Static stub/sensitive-surface scan: no TODO/FIXME/placeholder production path, no UI-persisted action ID and no arbitrary URL, selector, JavaScript, operation, evidence-cell or authority input.
- Git/runtime residual check: clean tree before summary; no database/WAL, HAR, trace or live-result artifact was created in the repository.
- Repository-wide unit attempt: **138/142 passed**; only the four previously recorded fixed-port installation cases failed while the healthy installed Phase 1 API owns port `43187`.
- Repository-wide integration attempt: **273/313 passed**; the same installed-service port cascades plus previously recorded job-busy/process-provisioning cases remain outside this plan. All plan-owned integration tests pass.

## Decisions Made

- Kept durable authority entirely server-held. The paired request is an admission boundary, while the authority secret and immutable binding hash never enter the browser request or response.
- Kept ordinary login actions process-local and restart-revoked. They cannot be supplied to a durable live result route or converted into L authority.
- Made reload recovery require a fresh pairing because CSRF remains memory-only. The new paired session then calls a fixed empty-body resume route; the user never supplies or sees an action ID.
- Returned no IDs from the general status projection. Only issue/resume responses on the already paired fixed route may place opaque IDs in module memory.
- Kept the production runtime conservative: an acknowledgement that cannot be corroborated by current post-issue source/lifecycle state becomes `human_needed`, not pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added durable pending/outcome read operations**

- **Found during:** Task 1 (paired-server scenario workflows)
- **Issue:** The Plan 35 store could issue, read by caller-supplied ID and consume actions, but server-projected recovery and predecessor checks cannot safely depend on a user-provided ID.
- **Fix:** Added validated `listPending(platform, scenario)` and `latestOutcome(platform, source, scenario)` queries over exact registry cells.
- **Files modified:** `packages/application/src/live-checkpoints.ts`, `packages/persistence/src/auth.ts`
- **Verification:** Restart recovery, predecessor, drift and exact-store integration tests pass.
- **Committed in:** `ad89030`

**2. [Rule 1 - Bug] Preserved a remaining paired child after partial completion**

- **Found during:** Task 2 (scenario-bound controls and recovery)
- **Issue:** After the first source child completed, the service projected pass and the UI required exactly two correlations. A network interruption could therefore leave the second valid child durable but not operable.
- **Fix:** The service now projects remaining pending children, and the UI safely submits one or two recovered source children while never replaying an absent/consumed child.
- **Files modified:** `packages/application/src/live-checkpoints.ts`, `apps/status/src/main.ts`, `tests/integration/live-checkpoint-workflows.test.ts`, `tests/ui/auth-live-actions.spec.ts`
- **Verification:** Focused integration 29/29, focused UI 4/4 and full UI 34/34 pass.
- **Committed in:** `47e54bb`

---

**Total deviations:** 2 auto-fixed (1 missing critical recovery operation, 1 partial-progress bug). **Impact:** Both changes are required for secure ID-free durable recovery; no live, source, release or requirement scope expanded.

The generic requirement-completion and shared sequential state updates were intentionally not applied. This plan ran in a shared wave, and project policy requires AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02 and UAT-01 to remain Pending until required live/human evidence exists.

## Issues Encountered

- The full unit and integration commands still encounter the already documented fixed-port environment conflict because the healthy installed Phase 1 API owns `127.0.0.1:43187`. This plan did not stop or alter that service.
- The repository-wide integration run also retained the previously documented job-recovery SQLite-busy timing and process/install cleanup cascades. They do not intersect the plan-owned files or focused passing suites and remain in `deferred-items.md`.

## Known Stubs

None. The standalone production API composes the durable store, authority, runtime and fixed routes. Tests may omit the optional injected live service, in which case the live-only routes fail closed with a safe 503; that compatibility seam does not create an alternate evidence path.

## Threat Flags

None. The new paired routes, durable recovery, writer-authority boundary and UI correlation handling are exactly the planned T2-36-01 through T2-36-04 surfaces and have strict negative coverage.

## Authentication Gates

None. No official page, login, MFA, source or live UAT was attempted.

## User Setup Required

None for this synthetic implementation plan. Later approved release/live plans retain their hard publication, update, official-login, restart, cross-day and user-confirmation gates.

## Next Phase Readiness

- Plans 02-37 through 02-41 can use the production paired workflow rather than scripts or caller-constructed evidence to drive exact future L results.
- This implementation does not satisfy a live checkpoint by itself. Windows/live status, Phase 1 partial status, all Pending requirements and the Phase 3 block remain unchanged.

## TDD Gate Compliance

PASSED. Each task has a failing `test(02-36)` commit followed by its `feat(02-36)` GREEN commit, and all focused tests are green at completion.

## Self-Check: PASSED

All seven planned production/test files and this summary exist; all four RED/GREEN commits are present; typecheck, production build, 29/29 focused integration checks, 4/4 focused UI checks and 34/34 full UI checks pass; no database/WAL or live-result artifact is present; and STATE, ROADMAP, REQUIREMENTS, Windows/live status, Phase 1 partial status and the Phase 3 block remain unchanged.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
