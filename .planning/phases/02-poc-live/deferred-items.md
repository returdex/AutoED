# Phase 2 Deferred Items

## Plan 02-01

- **Out-of-scope verification environment conflict:** The full unit suite cannot run four existing `tests/unit/credential-redaction.test.ts` cases while the installed Phase 1 API owns the fixed loopback port `43187`. The approved Node 24.20.0 toolchain clears the separate host-Node mismatch and runs 65/69 tests successfully; all 30 Plan 02-01 targeted tests pass. Plan 02-01 does not authorize stopping the installed service or changing the fixed-port Phase 1 contracts, so this remains a verification-environment item for orchestration or a later approved maintenance window.
