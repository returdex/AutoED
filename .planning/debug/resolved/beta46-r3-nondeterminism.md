---
status: resolved
trigger: "beta.46 first formal R3 stopped at COMMAND_PROCESS_FAILED_INTEGRATION_TWO_BUILD_UPGRADE; the failed bounded runner retained no attributable cause."
created: 2026-09-13T03:05:00+10:00
updated: 2026-09-13T16:40:15+10:00
---

# Debug Session: beta.46 R3 nondeterminism

## Symptoms

- Expected behavior: The selected-candidate R3 runner executes every fixed test file deterministically, reports a safe attributable failure category when a child exits nonzero, and never loses the distinction between test failure, timeout, signal, incomplete execution or process cleanup.
- Actual behavior: The first beta.46 R3 run reached `two-build-upgrade.test.ts` and returned only `PRE_SOURCE / COMMAND_PROCESS_FAILED_INTEGRATION_TWO_BUILD_UPGRADE`. The exact file later produced an 8/9 result followed by the 300-second test timeout, while a separate run passed 9/9.
- Safety result: beta.46 was invalidated before R4; no signed artifact, tag, release, installation, login, live evidence, 02-15 or Phase 3 action occurred.

## Boundary

- Diagnosed and fixed only the R3 failure-attribution path and the directly proven nondeterministic two-build test-support/runtime boundary.
- Did not select beta.47, create an R1/R2/R3 release receipt, sign, publish, install, update, log in, access school sources/Profile data, create live evidence, or advance 02-15/Phase 3.
- Preserved strict process ownership, credential isolation, cleanup, timeouts, sensitive-output scanning and zero-skip/todo rules.

## Evidence

- The fixed R3 runner checked a nonzero child before invoking its report parser, emitted only `COMMAND_PROCESS_FAILED_<step>`, and discarded the already bounded child output for attribution.
- `runUpgradeCLI` spawned its updater outside `createHarness`, did not close confirmation stdin, did not reclaim the child on timeout, derived a failure code by deleting non-uppercase stderr characters, and waited a fixed 61 seconds before every ordinary upgrade.
- Removing only that 61-second wait reliably exposed `PROCESS_OWNERSHIP_UNCONFIRMED_QUIESCED_INTENT` during immediate A-to-B upgrade.
- The old API used one `WindowLimit(30)` for all authenticated requests. Initial-install selfcheck consumed the ordinary bucket, so the immediately following upgrade's authenticated `/api/process/inspect` or `/api/control/shutdown` request received 429. The process supervisor intentionally collapsed that rejected proof to ownership-unconfirmed. Waiting 61 seconds merely reset the window.
- A regression test saturated 30 ordinary authenticated requests and proved the pre-fix lifecycle inspection also returned 429.

## Eliminated

- Deterministic product or manifest failure: the exact file and the full A-to-B path passed without artifact/source drift once the lifecycle budget was isolated.
- GitHub account, signing key, release archive or remote availability: the failure occurred inside synthetic integration before R4 and without any network or signing operation.
- Synthetic port collision as the causal boundary: the exact immediate-upgrade failure was repeatable as an authenticated lifecycle-control rejection and disappeared without changing port allocation.
- A need for longer timeouts or retries: removing the fixed minute made the repaired path faster and repeatable.

## Resolution

- root_cause: Ordinary authenticated API traffic and privileged lifecycle ownership/shutdown control shared one 30-request window. Initial selfcheck could exhaust it before immediate upgrade. The fixture's 61-second sleep hid the defect, while its unowned child and lossy stderr transformation turned failures into nondeterministic 300-second stalls and unusable codes.
- fix: Added a separate bounded lifecycle limiter for `/api/process/inspect` and `/api/control/shutdown` while retaining authentication and authorization; removed the 61-second delay; moved the interactive updater under harness ownership; closed stdin after the exact preview confirmation; added bounded output, timeout cleanup and stable sanitized fixture errors; classified bounded R3 nonzero output as timeout, assertion failure, incomplete test run, signal or generic nonzero exit.
- verification: Managed typecheck passed. Authentication/release-gate integration tests passed 58/58. Harness and credential-isolation unit tests passed 28/28. Relevant recovery CLI tests passed 2/2. The complete two-build file passed 9/9 in 134.94 seconds, and the critical immediate A-to-B CLI/API/Worker test then passed twice consecutively in 46.97 and 47.07 seconds with owned-process reclamation after each run.
- files_changed: `apps/api/src/main.ts`, `packages/test-support/src/harness.ts`, `packages/test-support/src/upgrade-fixture.ts`, `scripts/release/phase2-rehearsal-reporter.mjs`, `scripts/release/phase2-rehearsal.mjs`, `tests/integration/local-auth.test.ts`, `tests/integration/phase2-release-gates.test.ts`, `tests/integration/upgrade-recovery.test.ts`.

## Next Gate

- The bounded R0 diagnosis and corrective focused verification are complete.
- `active update candidate: none`. A complete fresh unnumbered R1 on the corrective commit and separate user authorization are still required before beta.47 may be selected.
