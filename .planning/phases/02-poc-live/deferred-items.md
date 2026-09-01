# Phase 2 Deferred Items

## Plan 02-01

- **Out-of-scope verification environment conflict:** The full unit suite cannot run four existing `tests/unit/credential-redaction.test.ts` cases while the installed Phase 1 API owns the fixed loopback port `43187`. The approved Node 24.20.0 toolchain clears the separate host-Node mismatch and runs 65/69 tests successfully; all 30 Plan 02-01 targeted tests pass. Plan 02-01 does not authorize stopping the installed service or changing the fixed-port Phase 1 contracts, so this remains a verification-environment item for orchestration or a later approved maintenance window.

## Plan 02-02

- **Out-of-scope verification environment conflict:** The repository-wide unit run remains 65/69 because the installed Phase 1 API owns fixed loopback port `43187`. The repository-wide integration run is 93/133; most failures are fixed-port installation/runtime fixtures and their cleanup cascades. Plan 02-02 does not authorize stopping or altering that installed service. The Plan 02-02 focused integration surface passes 21/21 under the approved Node 24.20.0 toolchain.
- **Pre-existing isolated regression outside this plan:** `tests/integration/job-recovery.test.ts` case `bounded SQLite busy failure never destroys a previous result` unexpectedly resolves instead of observing `SQLITE_BUSY`, including when run outside the full-suite port conflicts. The Plan 02-02 schema/store tests do not alter that job path, so no unrelated timing-harness change was made.

## Plan 02-04

- **Out-of-scope verification environment conflict:** The repository-wide unit run passes 95/99 tests, including all 30 new auth-state tests, while the same four existing `tests/unit/credential-redaction.test.ts` cases cannot use fixed loopback port `43187` because the healthy installed Phase 1 API owns it. Plan 02-04 does not authorize stopping the installed service or changing Phase 1 installation behavior; the focused auth-state, auth-contract and import-boundary run passes 60/60 under managed Node 24.20.0.

## Plan 02-05

- **Out-of-scope verification environment conflict:** The repository-wide unit run passes 96/100; the same four existing `tests/unit/credential-redaction.test.ts` cases cannot bind fixed loopback port `43187` while the healthy installed Phase 1 API owns it. The repository-wide integration run passes 144/184; fixed-port installation/runtime cases and cleanup cascades account for 39 failures, and the previously recorded isolated SQLite-busy timing case accounts for the remaining failure. Plan 02-05 does not authorize stopping the installed service or changing unrelated Phase 1/job fixtures. The focused Local Playwright BrowserProvider suite passes 41/41 and managed typecheck/static security gates pass.

## Plan 02-06

- **Out-of-scope verification environment conflict:** The repository-wide integration run passes 208/248. Fixed-port installation, upgrade, client and cleanup fixtures cascade from `PORT_CONFLICT_REPREVIEW` while the healthy installed Phase 1 API owns loopback port `43187`; the separately recorded SQLite-busy timing case is the remaining isolated failure. Plan 02-06 does not authorize stopping the installed service or changing unrelated Phase 1/job fixtures. The focused sealed-source and BrowserProvider integration surface passes 104/104, the auth-contract/import-boundary regression passes 30/30 and typecheck/static security gates pass under managed Node 24.20.0.

## Plan 02-07

- **Pre-existing isolated regression outside this plan:** The exact Task 2 integration command passes all 20 auth-worker and 3 Worker cases plus 13/14 existing job-recovery cases; only the previously recorded `bounded SQLite busy failure never destroys a previous result` timing case unexpectedly resolves instead of observing `SQLITE_BUSY`. Plan 02-07 does not authorize changing that unrelated timing harness. The focused auth-worker/job-storage/Worker surface passes 30/30, the schema-v3 auth-persistence regression passes 15/15, and typecheck/static security gates pass.

## Plan 02-12

- **Pre-existing process-lifecycle fixture failure outside this plan:** The required combined regression passes all 20 `auth-worker` cases, while the existing `process-lifecycle` case stops during its own synthetic initialization with `HUMAN_ACTION_REQUIRED: initialization interrupted; root preserved`, including when run alone. Plan 02-12 changes only the native Profile test harness/test and does not alter Phase 1 provisioning or stop the healthy installed API. The new 12-case macOS native Profile suite, 8-case native process/platform regression and typecheck all pass.

## Plan 02-35

- **Out-of-scope repository-wide verification failures:** The managed Node 24.20.0 full unit run passes 127/131 tests; only the four previously recorded fixed-port `credential-redaction` cases cannot bind while the installed Phase 1 API owns `43187`. The full integration run passes 249/291 tests. Its failures are the same installed-service port-conflict cascades, the previously recorded `job-recovery` SQLite-busy timing case and `process-lifecycle` provisioning interruption, plus current shared-tree compiled release/client/upgrade fixtures rejected by the status-asset browser-import guard (`BROWSER_IMPORT_DENIED`). Plan 02-35 does not authorize stopping the installed service or changing those unrelated modules. Its exact contract suites pass 48/48 unit checks and its persistence suites pass 40/40 integration checks with typecheck green.

## Plan 02-37

- **Out-of-scope verification environment conflict:** The managed Node 24.20.0 focused Phase 2 gate/API/persistence/security/workflow surface passes 58/58 integration tests, the complete native suite passes 24/24 and typecheck passes. Repository-wide unit and fixed-port installer runs still cannot bind loopback port `43187` while the existing installed Phase 1 API owns it; the observed failures are `PORT_CONFLICT_REPREVIEW`. Plan 02-37 does not authorize stopping an installed detached service or changing the fixed-port installation contract, so that process was not touched.

## Plan 02-41

- **Out-of-scope verification environment conflict:** The managed Node 24.20.0 focused release, live/update and trust regression passes 38/41 integration tests. The three existing `install-preview` cases stop at `PORT_CONFLICT_REPREVIEW` because the healthy installed Phase 1 API (PID observed as an installed `AutoED-Rebuild-M1` service, not a repository test process) owns fixed loopback port `43187`. Plan 02-41 does not authorize stopping the installed service or changing the installation contract. Excluding that known fixed-port fixture, all 38 executed release/toolchain tests pass; the Phase 2 release/live suites pass 26/26, and typecheck/syntax gates pass.

## Plan 02-38 Resolution

- **Resolved without touching the installed service:** The historical Phase 2 fixed-port cascades, SQLite-busy timing case, process-initialization wait and browser-route conflict were repaired in test support under the approved Rule 1/3 scope. Synthetic lifecycle fixtures now use an explicit run-scoped ephemeral port while separate contract coverage proves production remains fixed to loopback port `43187`. The complete managed-Node suite is green: unit `143/143`, integration `341/341`, UI `34/34` and macOS native `24/24`, with zero skip/todo. Earlier entries remain as historical execution evidence, not current blockers.
