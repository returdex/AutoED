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
