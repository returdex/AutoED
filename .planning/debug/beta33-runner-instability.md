---
status: fixing
trigger: "Beta.36 R3 reproduced HUMAN_RECOVERY_REQUIRED_PROCESS_STOP_UNCONFIRMED across two complete candidate gates."
created: 2026-09-02T11:40:00Z
updated: 2026-09-03T03:12:00+10:00
---

# Debug Session: beta.33 release-runner instability

## Symptoms

- R1 on the exact source passed 358 serial integration tests.
- Initial R3 failed `managed-cleanup` with `LOCAL_VOLUME_UNCONFIRMED_PREVIEW_INTENT`; `/sbin/mount` then completed in 0.01 seconds and the focused scenario passed.
- The first required fresh complete candidate gate passed all five suites.
- The second required fresh complete gate failed `upgrade-recovery` with `HUMAN_RECOVERY_REQUIRED`.
- Read-only process inspection found multiple orphaned `autoed-synthetic-*` API/Worker processes from interrupted historical test runs. They are test-only paths, not the user's beta.19 installation, but they show that interrupted runners can leave owned synthetic processes behind.

## Boundary

Do not weaken local-volume, process-ownership, host-ownership, cleanup or human-recovery checks. Do not sign, publish, update or log in from this repair session. Beta.34 is permanently consumed by the failed selection/build attempt.

## Current focus

1. Done: preserve the exact recovery `causeCode` internally while exposing only a bounded safe error message.
2. Done: add a pre/post suite synthetic-process ownership ledger and fail before tests when a prior run leaves an owned process.
3. Done: reclaim only a disposable-root process whose command, root, receipt and start identity match and whose recorded test owner has exited; the beta.19 installation remains outside the ledger.
4. Done: bound process/listener and local-volume probes without weakening fail-closed behavior.
5. Done: complete the managed R1 suites and a fresh unnumbered release rehearsal; no beta number was assigned.
6. In progress: make rehearsal attestation writing verify the exact on-disk build identity and rerun R0/R1 after the source fix.
7. In progress: align the immutable download allowlist with the canonical v-prefixed candidate tag while retaining historical no-v tags.
8. In progress: verify the explicit-stop recovery boundary through a fresh R0/R1 before beta.37.

## Repair evidence

- timestamp: 2026-09-02T22:33:00+10:00
  observation: Added protected per-harness run markers and a suite pre/post ledger. It ignores the persistent beta.19 service, validates disposable-root command/receipt/start identity, and only reclaims a process after the recorded test owner has exited. No synthetic service remained after the process-lifecycle and cleanup groups.
- timestamp: 2026-09-02T22:51:00+10:00
  observation: Added bounded macOS process-observation retries, bounded listener retries, and a two-attempt mount-table probe. Fail-closed ownership and local-volume errors remain unchanged after the retry budget.
- timestamp: 2026-09-02T22:59:00+10:00
  observation: Managed Node typecheck passed; unit suite passed 144 tests; process-lifecycle and managed-cleanup passed 8 tests; the previously unstable `upgrade-recovery` file passed all 8 tests; the feature-verified continuation passed in three consecutive fresh runs. No synthetic API/Worker process remained after each run.
- timestamp: 2026-09-02T23:58:21+10:00
  observation: Full managed R1 verification passed: typecheck, unit 144/144, integration 358/358, UI 34/34, macOS native 24/24, release/live contract tests 43/43, and four-surface sensitive scan 0 findings. The dual-target closure rehearsal passed with macOS 3,929 files and Windows 3,900 files, 8 assets per target, and zero sensitive findings. The validated unnumbered rehearsal is bound to the exact commit/tree/build and has no public release coordinate; no synthetic service or marker remained after the run.

## Resolution

- Root cause: interrupted serial runs could leave synthetic API/Worker processes behind, while process, listener and mount probes exposed transient observation failures without retaining a bounded cause. The harness had no protected, independently verifiable owner marker, so the next run could not safely distinguish an exact disposable orphan from an unrelated process.
- Fix: add a protected sibling run marker and pre/post synthetic-process ledger; reclaim only an exact disposable-root process after owner exit; add bounded process/listener/mount probes; preserve fail-closed ownership and recovery semantics; expose only an allowlisted recovery cause code.
- Verification: the complete managed R1 gate and fresh unnumbered release rehearsal passed on build `82c8139dd3aff64a8f66113137b427fa6a258f3e946f50fa1deff7804535910b`, with source/tree identity and sanitized attestation recorded separately. Beta.31/32/33 history is unchanged, and no beta.34 was selected.
- Selection sequencing: the current sanitized attestation is intentionally kept as an uncommitted planning output until R2 selection, so the candidate writer can bind it to the active checkout without another planning commit moving HEAD. The prior committed copy remains historical evidence only.

## Reopened failure

- timestamp: 2026-09-03T00:10:00+10:00
  observation: Beta.34 selection bound commit `ab7705c…`, tree `3f342c…`, build `82c8139d…` from the prior rehearsal. The exact R3 build on that same checkout produced `3ca40e6f…`; no signing, publication, install, login or live gate occurred.
- classification: `POST_SOURCE` / `STALE_REHEARSAL_BUILD_ID`; the candidate was locally selected, so beta.34 is consumed and must never be reused.
- fix: `writePhase2Rehearsal` now compares any on-disk `build/identity.json` against the attestation commit, tree, build ID and source hash, and a contract test covers stale identity rejection.

## Beta.35 R4 failure

- timestamp: 2026-09-03T01:20:00+10:00
  observation: R2 selected beta.35 and R3 passed. R4 signed/assembled initial macOS archive members, then bootstrap generation failed closed with `DOWNLOAD_URL_DENIED` because the canonical `v0.1.0-beta.35` tag path was not accepted by the allowlist.
- classification: `POST_SOURCE` / `DOWNLOAD_URL_DENIED`; beta.35 is permanently consumed. No publication, installation, login or live gate occurred; partial local assembly is retained only as ignored diagnostic output.
- fix: allow the optional `v` prefix for GitHub release tag paths and add a regression test covering both historical no-v and canonical v-prefixed tags. A fresh R0/R1 is required before beta.36.

## Beta.36 transient recurrence

- timestamp: 2026-09-03T03:05:00+10:00
  observation: The first complete beta.36 gate failed `upgrade-recovery` with `HUMAN_RECOVERY_REQUIRED_PROCESS_STOP_UNCONFIRMED`; focused `upgrade-recovery` then passed 8/8. A following complete gate passed 31/32 files but reproduced the same code in a different recovery scenario.
- classification: `POST_TRANSIENT` recurrence; beta.36 is permanently consumed because the required two consecutive complete gates did not pass.
- next action: return to R0/R1 and inspect process-stop observation/ownership and recovery teardown. Do not assign beta.37 until the repaired runner proves two clean complete candidate gates.

## Process-stop boundary repair

- root cause: reopen paths changed the maintenance generation and then passively waited for stale API/Worker heartbeats to self-stop. A process beginning that self-stop could be observed as `unknown` between two ownership checks, producing `PROCESS_OWNERSHIP_UNCONFIRMED` or a bounded stop timeout.
- fix: both normal upgrade and rollback recovery now issue authenticated process shutdown while the operation gate remains `exclusive`; only after all registered processes are confirmed stopped does the installer increment the gate generation locally. No signal is sent without an authenticated, matching process identity.
- focused evidence: `upgrade-recovery` snapshot rollback, expired-lease recovery, and compiled-CLI upgrade scenarios pass after the change. Fresh unnumbered R0/R1 remains the required next gate.
