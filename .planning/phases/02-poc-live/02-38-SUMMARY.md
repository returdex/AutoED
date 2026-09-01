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
  - immutable unused Phase 2 identity 0.1.0-beta.25
  - exact build-bound five-suite automated test report
  - explicit sanitized permanent invalidation of beta.21 through beta.24
affects: [02-39, 02-13, 02-14 through 02-34, Phase 2 release]
tech-stack:
  added: []
  patterns: [explicit synthetic-port injection, fail-closed client evidence, deterministic recovery faults, semantic dependency-path privacy classification, exact absent-tag classification, separate public and consumed version histories, source-bound quality receipts]
key-files:
  created:
    - release/phase2-build-selection.json
    - release/phase2-test-report.json
    - .planning/phases/02-poc-live/02-38-BETA-21-INVALIDATION.md
    - .planning/phases/02-poc-live/02-38-BETA-22-INVALIDATION.md
    - .planning/phases/02-poc-live/02-38-BETA-23-INVALIDATION.md
    - .planning/phases/02-poc-live/02-38-BETA-24-INVALIDATION.md
  modified:
    - scripts/build/assemble.mjs
    - scripts/release/publish.mjs
    - tests/integration/phase2-release-gates.test.ts
    - vitest.config.ts
    - packages/platform/src/installation.ts
    - packages/platform/src/processes.ts
    - packages/test-support/src/runtime-installation.ts
    - packages/test-support/src/upgrade-fixture.ts
    - tests/integration/client-wiring.test.ts
    - tests/integration/two-build-upgrade.test.ts
key-decisions:
  - "0.1.0-beta.21 through 0.1.0-beta.24 are permanently invalidated; 0.1.0-beta.25 is the next monotonically increasing consumed identity."
  - "Production installation remains fixed to loopback port 43187; only explicitly marked synthetic tests receive one run-scoped ephemeral port."
  - "The report binds only public identity, command/source hashes, bounded counts, zero findings and explicit gaps; it contains no raw output or live evidence."
requirements-completed: []
duration: 3h30min cumulative
completed: 2026-09-02
---

# Phase 2 Plan 38: Immutable Beta Quality Binding Summary

**Unused beta.25 is bound to the publisher-corrected source and five freshly green automated suites; beta.21 through beta.24 remain permanently invalidated, while every Windows/live/Phase 3 gate remains blocking.**

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

### Deterministic-assembly correction rerun

- **Duration:** 33 min
- **Started:** 2026-09-01T13:30:34Z
- **Completed:** 2026-09-01T14:03:51Z
- **Tasks:** 2
- **RED/GREEN commits:** 2
- **Invalidation/selection/report commits:** 3

### Publisher correction rerun

- **Duration:** 32 min
- **Started:** 2026-09-01T14:32:24Z
- **Completed:** 2026-09-01T15:04:08Z
- **Tasks:** 2
- **RED/GREEN commits:** 2
- **Invalidation/selection/report commits:** 3

## Selected Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.25` |
| Tag | `v0.1.0-beta.25` |
| Source commit | `f80ae3b6f7bb5f600e0a0a60b55c61c1a043f804` |
| Source tree | `8e702d1311e26dd26bd4b191a9157a5f29db4772` |
| Build ID | `6c44e404b42e72c8dfb3f1dfef3bb9aa1f5cb95f17de32280019cc23c89c20e5` |
| Source SHA-256 | `24478d9e7d392e538b0037cb4b804c629f0f864b427d585dc2d871f49bec221c` |
| Version-set SHA-256 | `d99d2c596d648d9c7a9dbab9e347f3294623a5e92216ffdc135fab4fce70ad62` |
| Selection SHA-256 | `4a2c250708d02ee19b2e44bd0de215850a08620ad3eac4ff0991702eeec94bae` |
| Test-report SHA-256 | `005c62b326bd13aa0ec62e583858b6377d0405454ca7f846011b9f789e18d51a` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

Immediately before beta.25 selection, unauthenticated read-only observations agreed that public, local and direct-remote tags/releases ended at beta.20. Neither beta.24 nor beta.25 existed as a tag, release or remote asset, and no Phase 2 publication/availability receipt existed. Beta.24 was consumed by immutable selection/report and local signed-artifact history, then permanently invalidated because corrective commits `c4cabf0` and `0e189bc` changed the publisher source before any remote mutation. Its ignored signed archives remain preserved historical bytes and cannot be published or relabelled.

## Automated Evidence

| Suite | Tests | Skipped | Todo | Command SHA-256 |
|---|---:|---:|---:|---|
| Typecheck | 1 command | 0 | 0 | `c8cdec81b63a83f09579ad0f57459db7cda7610a31a3a4d482fc74384df5b02d` |
| Unit | 143 | 0 | 0 | `b98c3b0584afe9dfa05fc96c87f247733c92ebd894229fb80b5e46c6035d8f50` |
| Integration | 346 | 0 | 0 | `b596a73c156f87c41f683dc1f4767070d87cf9eb22ebcb0503bff0ecbf90e0ea` |
| UI | 34 | 0 | 0 | `84d510b7e28d16445e7d3212cabe49a7cd8dd0280e5c5528b395f7527c9a7ca9` |
| macOS native | 24 | 0 | 0 | `50ca1a215155bb52b4fd8ced7a16c49135b26fc0fe3b6e1e6c2cc3882e599c66` |

- Task 1 exact verification filter: **3/3 intended tests passed**; 13 unrelated tests were excluded by the approved focused filter.
- No `describe/it/test.skip`, `.todo` or `.only` invocation exists in the test tree.
- Sensitive scan: **0 findings** over `tracked`, `history`, `working_tree` and `captured_output`; digest `cf08741c8b4f287a7b1b0e5b1d656f70e93968954c170f92a3ad6b9653f440eb`.
- Reachable history: 926 blobs checked; three reviewed detector/negative fixtures were accepted by the existing exact exception allowlist. The tracked surface covered 298 files / 3,967,456 bytes; captured output covered five fresh logs / 15,485 bytes.

## Hard Gaps

| Gate | State |
|---|---|
| Windows native | `not_run/human_needed` |
| Live evidence | `not_run/human_needed` |
| Phase 3 | `blocked` |

macOS automation/native evidence does not create L authority, satisfy Windows evidence or make Phase 3 eligible.

## Task Commits

Current publisher correction rerun:

1. **RED: require exact absent-tag classification and public/consumed reconciliation** — `c4cabf0`
2. **GREEN: reconcile absent tags and consumed beta identities fail-closed** — `0e189bc`
3. **Invalidate unpublished signed beta.24 and remove its active release metadata** — `f80ae3b`
4. **Task 1: lock publisher-corrected beta.25 identity** — `c8dc1d9`
5. **Task 2: bind complete fresh beta.25 quality evidence** — `000dc35`

Historical deterministic-assembly correction rerun:

1. **RED: prove declared cookie dependencies differ from runtime credential artifacts** — `ab833b2`
2. **GREEN: classify only package-name cookie segments under `node_modules` as dependencies** — `2958d61`
3. **Invalidate drifted beta.23 and remove it from active selection/reporting** — `435c983`
4. **Task 1: lock corrected beta.24 identity** — `18003e8`
5. **Task 2: bind complete fresh beta.24 quality evidence** — `03affa2`

Historical approved-correction rerun:

1. **Invalidate drifted beta.22 and remove it from active selection/reporting** — `1c614bf`
2. **Lock corrected beta.23 identity before later assembly correction** — `7be8c8f`
3. **Bind complete beta.23 quality evidence before later assembly correction** — `94d458d`

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

**8. [Rule 1 - Sensitive Path Classification] Distinguished declared dependencies from runtime Cookie artifacts**

- **Found during:** Plan 02-39 deterministic assembly of the beta.23 selected source
- **Issue:** The member-path privacy regex rejected the three locked production package paths containing package segments named `cookie`, although they are declared dependencies rather than runtime browser/credential artifacts.
- **Fix:** Added a failing regression for all three production paths plus `runtime/Profile`, `runtime/Cookie` and `runtime/Cookies` negatives, then allowed `cookie`/`cookies` only when the segment is structurally a package name immediately under a root or nested `node_modules`. Every runtime occurrence remains fail-closed.
- **Committed in:** RED `ab833b2`, GREEN `2958d61`

**9. [Rule 3 - Generated Build Output] Restored beta.24 output after the complete rerun**

- **Found during:** final beta.24 source/build binding check
- **Issue:** The complete integration fixtures correctly rebuilt ignored `dist/build` using their default current-HEAD identity, so generated output no longer matched selected beta.24 even though tracked source and build-input hashes remained exact.
- **Fix:** Rebuilt variant B at selected commit `435c983` in an isolated local clone, verified commit/tree/build equality, copied only ignored generated output back, and required byte-identical generated directories before report creation.
- **Committed in:** no source change; generated ignored output only

**10. [Rule 1 - Publisher Reconciliation] Separated exact absent tags, public releases and local consumption**

- **Found during:** Plan 02-13 immutable publication preflight before remote mutation
- **Issue:** GitHub reports an absent intended commit ref as a specific HTTP 422, while the publisher also compared the public release-set digest with the distinct local monotonic consumed-version digest. The former stopped a legitimate absence check and the latter could not represent unpublished invalidations honestly.
- **Fix:** Accepted only the exact queried-tag `No commit found for SHA` HTTP 422, retained fail-closed handling for every misleading/other 422, validated remote public versions against their own digest, validated the candidate against the complete local consumed prefix, and required exact active artifact/preflight identity before remote observation or mutation.
- **Committed in:** RED `c4cabf0`, GREEN `0e189bc`

**11. [Rule 3 - Generated Build Output] Restored beta.25 output after the complete rerun**

- **Found during:** final beta.25 source/build binding check
- **Issue:** The complete integration fixtures rebuilt ignored `dist/build` using their default current-HEAD identity, so generated output no longer matched selected beta.25 even though tracked source and build-input hashes remained exact.
- **Fix:** Rebuilt variant B at selected commit `f80ae3b` in an isolated local clone, verified commit/tree/build equality, copied only ignored generated output back, and required byte-identical generated directories before report creation.
- **Committed in:** no source change; generated ignored output only

Beta.21 was not repaired in place. Its failed counts and public identity are preserved in `02-38-BETA-21-INVALIDATION.md`. Beta.22 through beta.24 were also not rewritten: their invalidation records preserve exact identities, original receipts, correction bases and proof that no local/remote/public release object consumed them. Beta.24's signed archives remain ignored historical bytes and are not active publication inputs. Beta.25 alone is the active canonical selection/report.

**Total deviations:** 11 auto-fixed across the original and corrective reruns (6 Rule 1 correctness fixes, 5 Rule 3 blocking/generated-output fixes). **Impact:** All fixes preserve the exact production, privacy, version and evidence boundaries; no release, identity, live or platform scope expanded.

## TDD Gate Compliance

Task 1 consumes the already-implemented strict contract from Plan 02-41. The approved two-layer correction has RED/GREEN `3771e77` → `eb2843d`; deterministic assembly has `ab833b2` → `2958d61`; publisher reconciliation has `c4cabf0` → `0e189bc`. The complete 16-test release-gate file and typecheck passed before beta.25 selection. The Plan 02-38 focused selection filter then passed its exact three intended tests; no artificial failing test was introduced for a generated receipt.

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
- Permanently consumed beta.23 after the assembly-path correction rather than reusing its old green report.
- Permanently consumed beta.24 after the publisher correction rather than publishing its stale signed bytes.
- Selected beta.25 from the converged public/local/direct-remote version surfaces and all four prior invalidation histories.
- Allowed `cookie`/`cookies` only as declared package-name segments under `node_modules`; runtime Profile/Cookie/Cookies paths remain rejected.
- Kept remote public beta history separate from the monotonic local consumed prefix; only an exact intended-tag GitHub 422 is treated as absence.
- Kept the product port fixed while making test isolation explicit and non-production.
- Bound only safe hashes/counts/gaps into the release report; raw captured output remains ignored local test material.

## Next Phase Readiness

- Plan 02-39 must assemble and sign fresh beta.25 artifacts from this selection/report; beta.24 signed bytes and prompt are historical and cannot be reused.
- Any later source, tree, build, version-set or public-object race invalidates beta.25 and requires a new monotonically increasing candidate plus a full Plan 02-38 rerun.
- Windows native and all real live/UAT gates remain mandatory and blocking.

## Self-Check: PASSED

- Selection and test-report schemas validate read-only with the recorded selection/report digests.
- Version, source commit, tree, build ID and build-input hash exactly match the selected generated identity.
- All listed repair, invalidation, correction, selection and evidence commits exist; all four invalidation records and both active receipts exist.
- No beta.24 or beta.25 tag exists locally, no test skip/todo/only invocation exists, and `git diff --check` passes.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
