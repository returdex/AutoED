---
phase: 02-poc-live
plan: "10"
subsystem: auth-security-testing
tags: [security-matrix, sqlite, source-adapters, profile-ownership, worker-fencing, paired-api, evidence-isolation]
requires:
  - phase: 02-poc-live
    plans: ["02", "04", "06", "07", "08", "35"]
    provides: strict auth contracts, sealed adapters, protected Profile ownership, durable auth jobs, paired API, exact evidence registry
provides:
  - canonical 22-case T2-01 through T2-08 security registry with strict coverage assertions
  - cross-layer synthetic fault matrix for adapters, Profile ownership, Worker fencing, SQLite retention and paired loopback HTTP
  - complete 176-cell evidence-isolation baseline proving automated S/I cannot fill platform, class, source, scenario or live gaps
  - explicit blocked Phase 3 projection with all 44 L cells and native build obligations still missing
affects: [02-11 synthetic E2E, 02-12 beta release, 02-14 live UAT, Phase 3 gate, AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01]
tech-stack:
  added: []
  patterns: [pure canonical case registry, exact-once case execution, whole-ledger baseline hashing, payload-external evidence authority, raw loopback Host testing]
key-files:
  created:
    - packages/test-support/src/security-matrix.ts
    - tests/unit/auth-security-matrix.test.ts
    - tests/integration/auth-security-matrix.test.ts
    - tests/integration/evidence-isolation-matrix.test.ts
  modified: []
key-decisions:
  - "The canonical registry is inert frozen metadata: it contains no URL, selector, browser handle, Profile path, credential material or executable callback."
  - "Adapter fault tests assert the existing public fail-closed result vocabulary while independently proving internal origin/write/download guards execute before any prohibited side effect."
  - "Evidence progress is derived only from exact SQLite cells plus named obligations; automated macOS S/I cannot contribute to Windows, N, L or Phase 3 eligibility."
patterns-established:
  - "Exact-once security binding: every integration/evidence case selected from the canonical registry must execute once, with missing and duplicate execution failing afterAll."
  - "Rejected evidence mutation: hash all 176 cells and named obligation statuses before an attack, reject the append, then require the complete hash to remain identical."
requirements-completed: []
duration: 21min
completed: 2026-09-01
---

# Phase 2 Plan 10: Cross-Layer Security and Evidence-Isolation Matrix Summary

**A canonical 22-case matrix now proves fail-closed auth behavior across strict contracts, sealed adapters, protected Profile ownership, durable Worker/SQLite state, paired loopback HTTP and the complete evidence ledger while preserving every native/live hard gate.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-01T07:02:19Z
- **Completed:** 2026-09-01T07:23:31Z
- **Tasks:** 3 TDD tasks plus one integration-completeness correction
- **Files modified:** 4 source/test files

## Accomplishments

- Established one frozen registry for all 22 required cases, T2-01–T2-08 and the eight contract/state/adapter/Profile/Worker/persistence/API/evidence layers, with mutation tests that fail on missing, duplicate, empty or unknown dimensions.
- Verified the five auth failure classes retain distinct result codes, five-dimensional state, recovery disposition, last success and independent source state; display hints cannot establish identity authority and drift blocks course access.
- Drove actual sealed adapters with in-memory malicious pages for redirects, popups, interaction, form/quiz/upload writes, downloads, fallback APIs, marker drift, network failure and permission denial while every external/write/download/file counter stayed zero.
- Exercised a protected temporary Profile with running, expired-lease, unknown, PID-reuse, executable, nonce and control-proof faults; no record was deleted or reclaimed and every uncertain case remained `human_needed`.
- Exercised the real durable auth runner before request, before commit, during heartbeat and at the final SQL race for cancellation, lease, generation and fence loss; no stale observation, follow-up or receipt was committed.
- Used an ephemeral actual loopback API to verify public, CLI/MCP, CSRF, Origin, raw Host, Fetch-Site, restart-boundary, revocation, strict-body, method and path failures before all auth writers, while paired protected output remained the sole complete-identity destination.
- Hashed and re-read all 176 evidence cells plus named obligations around platform/class/source/scenario pollution attempts, then proved actual-platform S/I leaves all 44 L cells, native obligations, Windows evidence and Phase 3 eligibility pending.

## Task Commits

Each TDD gate and correction was committed atomically:

1. **Task 1 RED: canonical registry coverage gate** — `2457111` (test)
2. **Task 1 GREEN: canonical auth security matrix** — `497199c` (feat)
3. **Task 2 RED: integration exact-execution gate** — `2537e54` (test)
4. **Task 2 GREEN: adapter/Profile/Worker/API/SQLite matrix** — `3d3a177` (test)
5. **Task 3 RED: evidence-isolation exact-execution gate** — `32cac82` (test)
6. **Task 3 GREEN: durable evidence-isolation matrix** — `ceadc6a` (test)
7. **Integration completeness: remaining Profile/session/heartbeat edges** — `ff1e092` (test)

No separate REFACTOR commit was needed.

## Files Created/Modified

- `packages/test-support/src/security-matrix.ts` — Pure frozen canonical IDs, threat/layer mappings, expected dispositions, prohibited side effects, synthetic sentinels and fail-closed coverage validator.
- `tests/unit/auth-security-matrix.test.ts` — Table-driven auth/binding/state, strict input, protected/redacted output and S-only receipt contract checks.
- `tests/integration/auth-security-matrix.test.ts` — Actual sealed adapter, protected temporary Profile, durable Worker/SQLite and paired ephemeral loopback API fault matrix.
- `tests/integration/evidence-isolation-matrix.test.ts` — Actual SQLite authority/pollution, 176-cell baseline, append-only predecessor, redacted projection and Phase 3 hard-gate matrix.

## Verification

- TypeScript typecheck: **passed**.
- New unit matrix: **9/9 passed**.
- New cross-layer integration matrix: **8/8 passed**; all ten selected integration case IDs executed exactly once.
- New evidence-isolation matrix: **6/6 passed**; all four T2-08 case IDs executed exactly once.
- Upstream focused unit regression: **67/67 passed** across auth contracts, auth state and output policy.
- Upstream focused integration regression: **103/103 passed** across persistence, source adapters, auth Worker and paired auth API.
- Static safety: **22 cases, 8 threats, 8 layers and 4 files** verified; no disabled tests or executable/sensitive manifest fields.
- Tests used only in-memory malicious pages, temporary protected roots, temporary SQLite and ephemeral loopback HTTP. No school network, official login, real Profile, OS kill, publication, native producer or L success authority was used.

## Decisions Made

- Kept the registry as declarative frozen data and put all executable fault behavior in test suites, preventing untrusted source-like values from becoming operations.
- Preserved the approved adapter's public safe-code boundary: internal browser origin/write/download faults are separately identified by the fixture but collapse to the existing `CAPABILITY_DENIED` source result, while the reducer retains its distinct `ORIGIN_MISMATCH` state-machine code.
- Used Node's raw local HTTP client only for the Host-header negative because Fetch normalizes the Host header; every request still targets the harness-owned ephemeral `127.0.0.1` server.
- Kept AUTH-01–AUTH-04, SEC-02 and UAT-01 Pending. This plan creates S/I security evidence only and cannot complete native or live requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exercised hostile Host through raw loopback HTTP**
- **Found during:** Task 2 API negative verification
- **Issue:** The Fetch implementation normalized a caller-supplied hostile Host header, so that test request reached the API with the legitimate loopback Host and returned 200.
- **Fix:** Sent only the Host negative through Node's raw HTTP request API to the same harness-owned ephemeral loopback server. The actual API then observed the hostile Host and returned 403; Origin and Fetch-Site remained separate Fetch-based 403 checks.
- **Files modified:** `tests/integration/auth-security-matrix.test.ts`
- **Verification:** Cross-layer integration matrix 8/8 and upstream auth API 5/5 pass.
- **Committed in:** `3d3a177`

**2. [Rule 2 - Missing Critical Coverage] Completed the named Profile, session and heartbeat fault set**
- **Found during:** Plan-wide acceptance audit after Task 3
- **Issue:** The first green integration pass covered running/PID-reuse Profile states and request/commit fencing but did not yet exercise unknown/executable/control-proof ownership, lease-expired running holders, in-flight heartbeat abort, or session restart/revocation in the canonical suite.
- **Fix:** Added each missing fault using the same temporary Profile, durable Worker and actual loopback session implementations, with unchanged zero-write and exact-once case assertions.
- **Files modified:** `tests/integration/auth-security-matrix.test.ts`
- **Verification:** Typecheck, new 8/8 integration matrix and all 103 upstream focused integration tests pass.
- **Committed in:** `ff1e092`

---

**Total deviations:** 2 auto-fixed (1 blocking harness transport issue, 1 missing critical coverage set). **Impact:** Both changes completed the approved security assertions without changing production behavior or widening source, credential, Profile, platform, evidence or publication authority.

## Issues Encountered

- Cross-origin adapter navigation intentionally presents the established public `CAPABILITY_DENIED` result even though the reducer has a distinct `ORIGIN_MISMATCH` state-machine code. The matrix verifies both the approved vocabulary and the underlying zero-read/zero-write origin guard rather than changing the existing contract in a test-only phase.

## Known Stubs

None. Empty Windows/N/L cells, `not_run`, `human_needed`, unverified shared Profile and blocked Phase 3 are required honest gate states, not placeholders.

## Threat Flags

None. This plan added test metadata and local synthetic/temporary verification only; it introduced no endpoint, credential path, source access, Profile location, schema migration or external network surface.

## Authentication Gates

None. No official page was opened and no password, MFA, credential, real session or live action was requested.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-11 can consume the canonical registry and the established malicious-fixture expectations for synthetic E2E assembly.
- Beta/live work remains blocked on its own approved plans and human gates. Windows remains `not_run / human_needed`; all 44 L cells remain missing; Phase 1/2 are not globally complete and Phase 3 remains blocked.
- Shared `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` tracking is intentionally left to the wave orchestrator; no requirement was marked complete by automated S/I evidence.

## Self-Check: PASSED

All four listed source/test files and this SUMMARY exist; commits `2457111`, `497199c`, `2537e54`, `3d3a177`, `32cac82`, `ceadc6a` and `ff1e092` are present in order. Typecheck, all new suites, focused upstream regressions and the 22-case/8-threat/8-layer static gate pass. Stub-pattern hits were only intentional test accumulators, nullable injected-error state and empty option defaults; no goal-blocking stub exists.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
