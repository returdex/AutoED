---
phase: 02-poc-live
plan: "38"
subsystem: release-quality
tags: [beta-selection, quality-gate, sensitive-scan, immutable-identity, macos-native]
requires:
  - phase: 02-poc-live
    plans: ["10", "11", "12", "36", "37", "41"]
    provides: production auth workflow, complete release contracts and fixed quality schemas
provides:
  - immutable unused Phase 2 identity 0.1.0-beta.23
  - exact build-bound five-suite automated test report
  - explicit sanitized permanent invalidation of beta.21 and drifted beta.22
affects: [02-39, 02-13, 02-14 through 02-34, Phase 2 release]
tech-stack:
  added: []
  patterns: [explicit synthetic-port injection, fail-closed client evidence, deterministic recovery faults, source-bound quality receipts]
key-files:
  created:
    - release/phase2-build-selection.json
    - release/phase2-test-report.json
    - .planning/phases/02-poc-live/02-38-BETA-21-INVALIDATION.md
    - .planning/phases/02-poc-live/02-38-BETA-22-INVALIDATION.md
  modified:
    - vitest.config.ts
    - packages/platform/src/installation.ts
    - packages/platform/src/processes.ts
    - packages/test-support/src/runtime-installation.ts
    - packages/test-support/src/upgrade-fixture.ts
    - tests/integration/client-wiring.test.ts
    - tests/integration/two-build-upgrade.test.ts
key-decisions:
  - "0.1.0-beta.21 and drifted 0.1.0-beta.22 are permanently invalidated; 0.1.0-beta.23 is the next monotonically increasing consumed identity."
  - "Production installation remains fixed to loopback port 43187; only explicitly marked synthetic tests receive one run-scoped ephemeral port."
  - "The report binds only public identity, command/source hashes, bounded counts, zero findings and explicit gaps; it contains no raw output or live evidence."
requirements-completed: []
duration: 2h25min cumulative
completed: 2026-09-01
---

# Phase 2 Plan 38: Immutable Beta Quality Binding Summary

**Unused beta.23 is bound to the approved two-layer prompt source and five freshly green automated suites; beta.21 and drifted beta.22 remain permanently invalidated, while every Windows/live/Phase 3 gate remains blocking.**

## Performance

- **Duration:** 1 h 53 min
- **Started:** 2026-09-01T10:23:29Z
- **Completed:** 2026-09-01T12:15:36Z
- **Tasks:** 2
- **Repair commits:** 5
- **Selection/report commits:** 2

### Approved-correction rerun

- **Duration:** 32 min
- **Started:** 2026-09-01T12:47:44Z
- **Completed:** 2026-09-01T13:19:24Z
- **Tasks:** 2
- **Invalidation/selection/report commits:** 3

## Selected Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.23` |
| Tag | `v0.1.0-beta.23` |
| Source commit | `1c614bfeac4f7e0d83de66764ccecaf8ef916946` |
| Source tree | `e84d877310fe830bc4d721bbc7c304190703f021` |
| Build ID | `ee2e76977d864622c72a85cd225ad05264b11b774e1be628338dd833d404d981` |
| Source SHA-256 | `a1bfd710c84aea182d1e255b333c58195183bdf4f6e62c890887a7961ca099df` |
| Version-set SHA-256 | `464823dd1f0efa77a8a826542782f2060932136b05d37f9826b526ee6d44dc8f` |
| Selection SHA-256 | `20dca3e5731de361bde503e1f84a5b72d68730768549dbd8378b09af6043db07` |
| Test-report SHA-256 | `046cdbfef774a8cbe944761c10e517c3e13e3f3d903813fc2583455937459218` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

Immediately before beta.23 selection, unauthenticated read-only observations agreed that public, local and direct-remote tags/releases ended at beta.20. Neither beta.22 nor beta.23 existed as a tag, release or asset, and no Phase 2 artifact/prompt/publication/availability receipt existed. Beta.22 was therefore consumed only by its immutable local selection/report history, then permanently invalidated because corrective commits `3771e77` and `eb2843d` changed the approved source. No tag, release, asset or remote object was created or changed.

## Automated Evidence

| Suite | Tests | Skipped | Todo | Command SHA-256 |
|---|---:|---:|---:|---|
| Typecheck | 1 command | 0 | 0 | `c8cdec81b63a83f09579ad0f57459db7cda7610a31a3a4d482fc74384df5b02d` |
| Unit | 143 | 0 | 0 | `b98c3b0584afe9dfa05fc96c87f247733c92ebd894229fb80b5e46c6035d8f50` |
| Integration | 343 | 0 | 0 | `b596a73c156f87c41f683dc1f4767070d87cf9eb22ebcb0503bff0ecbf90e0ea` |
| UI | 34 | 0 | 0 | `84d510b7e28d16445e7d3212cabe49a7cd8dd0280e5c5528b395f7527c9a7ca9` |
| macOS native | 24 | 0 | 0 | `50ca1a215155bb52b4fd8ced7a16c49135b26fc0fe3b6e1e6c2cc3882e599c66` |

- Task 1 exact verification filter: **3/3 intended tests passed**; 10 unrelated tests were excluded by the approved focused filter.
- No `describe/it/test.skip`, `.todo` or `.only` invocation exists in the test tree.
- Sensitive scan: **0 findings** over `tracked`, `history`, `working_tree` and `captured_output`; digest `b9d0f8200e692b4d54b669a04391d0d0e62b181982d3dd7eaa8e98b1b0da4685`.
- Reachable history: 902 blobs checked; three reviewed detector/negative fixtures were accepted by the existing exact exception allowlist. The tracked surface covered 295 files / 3,935,654 bytes; captured output covered five fresh logs / 16,098 bytes.

## Hard Gaps

| Gate | State |
|---|---|
| Windows native | `not_run/human_needed` |
| Live evidence | `not_run/human_needed` |
| Phase 3 | `blocked` |

macOS automation/native evidence does not create L authority, satisfy Windows evidence or make Phase 3 eligible.

## Task Commits

Current approved-correction rerun:

1. **Invalidate drifted beta.22 and remove it from active selection/reporting** — `1c614bf`
2. **Task 1: lock corrected beta.23 identity** — `7be8c8f`
3. **Task 2: bind complete fresh beta.23 quality evidence** — `94d458d`

Historical first run:

- **Task 1: lock beta.22 identity** — `8020043`
- **Task 2: bind beta.22 quality evidence before later source correction** — `916bcc8`

Supporting repair/invalidation commits:

- `6608556` — generation-aware architecture assertion, current schema-v5 gates and deterministic SQLite-busy proof.
- `b388f7d` — explicit run-scoped synthetic port isolation with production fixed-port coverage retained.
- `a71e5a1` — composable Playwright route fallback while non-loopback requests remain denied.
- `5a01c86` — deterministic owned client-host exit/readiness race handling.
- `b75ff5f` — future-schema recovery fault, fail-closed MCP mismatch projection and stopped-backend stdio contract.
- `4e3f81e` — permanent sanitized beta.21 invalidation and removal from active selection.
- `3771e77` / `eb2843d` — approved two-layer prompt RED/GREEN correction that invalidated beta.22.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Schema/Evidence Drift] Aligned full gates with current architecture and schema v5**

- **Found during:** first complete beta.21 quality run
- **Issue:** An architecture assertion ignored generation-aware ownership, several fixtures expected obsolete schemas, and SQLite busy behavior was timing-dependent.
- **Fix:** Made the assertion generation-aware, updated exact schema expectations and used a second exact database connection with `BEGIN IMMEDIATE` for deterministic busy evidence.
- **Committed in:** `6608556`

**2. [Rule 1 - Test Isolation] Preserved fixed product port while isolating synthetic lifecycle tests**

- **Found during:** full unit/integration runs with the installed service already owning port 43187
- **Issue:** Synthetic installation/runtime fixtures cascaded from the legitimate fixed-port conflict.
- **Fix:** Added one explicitly marked run-scoped ephemeral port, propagated it only through owned synthetic children, and retained separate tests proving production still requires port 43187 and rejects arbitrary ports.
- **Committed in:** `b388f7d`

**3. [Rule 1 - Browser Harness] Composed Playwright route handlers safely**

- **Found during:** full UI run
- **Issue:** A context handler consumed approved loopback routes before one-shot page fixtures could fulfill them.
- **Fix:** Used route fallback for approved loopback requests while continuing to abort non-loopback requests fail-closed.
- **Committed in:** `a71e5a1`

**4. [Rule 3 - Child Readiness] Failed fast on owned client-host exit**

- **Found during:** full two-build upgrade run
- **Issue:** The host child omitted synthetic port context and the harness waited only for stdout readiness after the child had exited.
- **Fix:** Propagated the exact test context and raced readiness against actual child exit without increasing timeouts.
- **Committed in:** `5a01c86`

**5. [Rule 1 - Fail-Closed Recovery] Corrected remaining client/recovery negatives**

- **Found during:** repaired full integration run
- **Issue:** The schema fault injected valid v5, the mismatched MCP assertion dereferenced deliberately absent evidence, and the direct stdio fixture omitted its synthetic port context.
- **Fix:** Injected future schema v6, asserted absent MCP projection explicitly, and passed only the two synthetic isolation variables so stopped API returns `BACKEND_UNAVAILABLE` without closing stdio.
- **Committed in:** `b75ff5f`

**6. [Rule 3 - Generated Build Output] Restored the exact selected output after quality fixtures rebuilt the default identity**

- **Found during:** final source/build binding check
- **Issue:** Source commit, tree and build-input digest remained exact, but an integration fixture had overwritten ignored `dist/build` output with the default HEAD identity.
- **Fix:** Rebuilt variant B from the selected commit in an isolated local clone, verified the expected build ID before copying only generated output back, and reran exact source/build binding successfully.
- **Committed in:** no source change; generated ignored output only

**7. [Rule 3 - Generated Build Output] Restored beta.23 output after the fresh rerun**

- **Found during:** final beta.23 source/build binding check
- **Issue:** The complete integration fixtures correctly rebuilt ignored `dist/build` using their default current-HEAD identity, so the generated output no longer matched the selected beta.23 source even though tracked source and build-input hashes remained exact.
- **Fix:** Rebuilt variant B at selected commit `1c614bf` in an isolated local clone, verified commit/tree/build equality, copied only ignored generated output back, and required byte-identical generated directories before report creation.
- **Committed in:** no source change; generated ignored output only

Beta.21 was not repaired in place. Its failed counts and public identity are preserved in `02-38-BETA-21-INVALIDATION.md`. Beta.22 was also not rewritten: `02-38-BETA-22-INVALIDATION.md` preserves its public identity, original receipt/report commits, correction basis and proof that no local/remote/public release object consumed it. Beta.23 alone is the active canonical selection/report.

**Total deviations:** 7 auto-fixed across the original run and approved-correction rerun (4 Rule 1 correctness fixes, 3 Rule 3 blocking/generated-output fixes). **Impact:** All fixes preserve the exact production and evidence boundaries; no release, identity, live or platform scope expanded.

## TDD Gate Compliance

Task 1 consumes the already-implemented strict contract from Plan 02-41. The approved two-layer correction has RED commit `3771e77` followed by GREEN commit `eb2843d`; its focused release/live/update tests passed 28/28 before this rerun. The Plan 02-38 focused selection filter then passed its exact three intended tests before beta.23 selection; no artificial failing test was introduced for a generated receipt.

## Known Stubs

None. The Windows/live/Phase 3 states above are intentional hard gates, not placeholders.

## Threat Flags

None. Synthetic port injection is guarded by explicit test-only metadata and preserves the production fixed-port contract; no new endpoint, authorization path, schema trust boundary or public file-access surface was introduced.

## Authentication Gates

None encountered or invoked. Repository/version checks used unauthenticated read-only public observations. No login, token acquisition, credential/Profile access or source action occurred.

## External Mutation Boundary

- No signing, assembly, publication, tag, release, asset, push or remote mutation occurred.
- No update, installation, login/MFA, source access, Profile access or live evidence operation occurred.
- The existing installed service was not stopped, killed, authenticated to or reclaimed.
- Only the two active Plan 02-38 release receipts plus sanitized invalidation/summary metadata were created.

## Decisions Made

- Permanently consumed beta.21 rather than rewriting its failed immutable selection.
- Permanently consumed beta.22 after the approved source correction rather than reusing its old green report.
- Selected beta.23 from the converged public/local/direct-remote version surfaces and both prior invalidation histories.
- Kept the product port fixed while making test isolation explicit and non-production.
- Bound only safe hashes/counts/gaps into the release report; raw captured output remains ignored local test material.

## Next Phase Readiness

- Plan 02-39 may consume beta.23 selection/report for local assembly and signing only if its own source/version preflight still matches.
- Any later source, tree, build, version-set or public-object race invalidates beta.23 and requires a new monotonically increasing candidate plus a full Plan 02-38 rerun.
- Windows native and all real live/UAT gates remain mandatory and blocking.

## Self-Check: PASSED

- Selection and test-report schemas validate read-only with the recorded selection/report digests.
- Version, source commit, tree, build ID and build-input hash exactly match the selected generated identity.
- All listed repair, invalidation, correction, selection and evidence commits exist; both invalidation records and both active receipts exist.
- No beta.22 or beta.23 tag exists locally, no test skip/todo/only invocation exists, and `git diff --check` passes.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
