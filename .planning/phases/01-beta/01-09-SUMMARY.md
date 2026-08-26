---
phase: 01-beta
plan: "09"
subsystem: installer-upgrade
tags: [sqlite-backup, durable-journal, maintenance-generation, safe-rollback, owned-processes]
requires:
  - phase: 01-08
    provides: verified manifest envelopes, protected bootstrap staging, stable managed launchers
  - phase: 01-06
    provides: authenticated CLI/MCP selfcheck and native-bound local HTTP client
  - phase: 01-05
    provides: independent API/Worker lifecycle and owned-process control
provides:
  - fsynced intent/done upgrade journal with native-owned update and MCP admission locks
  - SQLite backup fencing, actual A-to-B activation, generation restart, and normal-operation probes
  - evidence-gated rollback, no-previous-install recovery, bounded cleanup, and queryable failure projection
  - production installer CLI composition through the complete upgrade engine
affects: [01-10 artifact assembly, 01-11 release manifests, 01-14 native upgrade UAT]
tech-stack:
  added: []
  patterns: [hash-chained journal boundaries, monotonic deadlines, verified-envelope recovery, exact-owned cleanup]
key-files:
  created: [packages/installer/src/journal.ts, packages/installer/src/snapshot.ts, packages/installer/src/upgrade.ts, packages/installer/src/recovery.ts, packages/installer/src/cleanup.ts, packages/test-support/src/upgrade-fixture.ts]
  modified: [packages/installer/src/install.ts, packages/installer/src/launchers.ts, packages/platform/src/client-host.ts, packages/client/src/http.ts, scripts/install/selfcheck.mjs]
key-decisions:
  - "An update lock has no TTL: only the same native identity or proven owner absence can recover it."
  - "Rollback requires a currently reverified persisted envelope, complete snapshot, unchanged business-write generation, compatible schema, and owned process/host reality."
  - "Failure projection uses the authenticated API while it is live and the direct SQLite adapter only after exclusive, process-absent proof."
  - "The stable installer CLI keeps its fixed arguments and enters the full engine; stage-only installConfirmed remains an explicit library/test boundary from Plan 08."
patterns-established:
  - "Every external upgrade effect has a durable intent and done record with a hash-linked predecessor."
  - "Activation recovery recognizes and hashes all five exact rename realities before completing any remaining rename."
  - "Unknown host, PID/start identity, startup reference, pin, permission, clock, or projection state preserves the recovery scene and returns human action or cleanup_pending."
requirements-completed: []
duration: 1h 36m
completed: 2026-08-27
---

# Phase 1 Plan 09: Durable Upgrade, Recovery, and Cleanup Summary

**Hash-linked upgrade transactions now drive real API/Worker/CLI/MCP selfchecks, fenced SQLite snapshots, evidence-gated rollback, and exact installation-owned cleanup.**

## Performance

- **Duration:** 1 hour 36 minutes
- **Started:** 2026-08-27T04:22:54+10:00
- **Completed:** 2026-08-27
- **Tasks:** 2
- **Files modified:** 23 unique source/test/support files across the two GREEN commits

## Accomplishments

- Persisted every preview, confirmation, download, quiesce, snapshot, migration, activation, selfcheck, cleanup, reopen, normal-probe, and completion boundary as protected `intent`/`done` records. A native owner receipt serializes both updater recovery and MCP host admission; neither lock expires by elapsed time.
- Used the actual `better-sqlite3` backup API with maintenance generation and business-write fences, integrity/schema verification, monotonic timeout accounting, streaming hashes, and explicit exclusion of Profile, credentials, archives, and arbitrary object paths.
- Ran an independently compiled A-to-B CLI upgrade through authenticated API maintenance, SQLite, Worker jobs, SDK MCP tools, candidate selfcheck, generation exit, fresh normal API/Worker restart, and a second real probe. The CLI interface did not gain a trust key, skip flag, arbitrary root from a tool, expected entry, URL, selector, command, or downgrade bypass.
- Implemented safe rollback only after revalidating the persisted old signed envelope and complete file tree, proving the snapshot/write/schema/process/host fences, atomically restoring the DB, restoring old launchers, and probing the old build in both maintenance and fresh normal generations. The result is `UPGRADE_FAILED_ROLLED_BACK`, never completion or automatic retry.
- Kept unsafe writes, schema changes, bad snapshots/signatures, unknown host/process receipts, mixed pins, unknown startup references, and denied cleanup queryable without changing the failed business state. First-install failure returns `INSTALL_FAILED_NO_PREVIOUS` and retains the four long-term credentials and data.
- Cleanup hashes the current and old launcher pin groups, rechecks exited host receipts natively, removes only exact obsolete launcher files and revoked selfcheck receipts, and records a signed-artifact rollback copy as explicitly inactive. Course archives, Profile canaries, unrelated data, legacy roots, and unknown files are never traversed or deleted.

## Task Commits

Each task followed the RED then GREEN sequence:

1. **09-1 RED: require durable upgrade boundaries and fenced SQLite snapshots** - `9bbd8fa`
2. **09-1 GREEN: execute durable fenced upgrade transactions** - `50fdf3c`
3. **09-2 RED: require safe rollback and ownership cleanup branches** - `c6466eb`
4. **09-2 GREEN: recover upgrades and clean owned runtime entries** - `0391c68`

## Files Created/Modified

- `packages/installer/src/journal.ts` - protected native-owned update lock, hash-linked boundaries, strict recovery resolution, admission state, and truthful projection timestamps.
- `packages/installer/src/snapshot.ts` - fenced backup API snapshot, integrity/schema checks, monotonic deadline, and bounded streaming database digest.
- `packages/installer/src/upgrade.ts` - verified runtime staging, exact launcher activation recovery, real service/selfcheck lifecycle, authenticated/offline projections, and failure receipts.
- `packages/installer/src/recovery.ts` - persisted-envelope revalidation, rollback gates, atomic database restore, old-generation selfchecks, and no-previous result.
- `packages/installer/src/cleanup.ts` - bounded runtime/host inventory, pin verification, inactive rollback receipt, and exact obsolete entry cleanup.
- `packages/installer/src/install.ts` - unchanged CLI surface composed into the complete upgrade engine after confirmation.
- `packages/platform/src/client-host.ts`, `apps/mcp/src/main.ts`, `packages/client/src/host.ts` - nonsecret protected host leases and update-lock admission.
- `packages/platform/src/client-endpoint.ts`, `packages/client/src/http.ts` - installer-only verified target endpoint and bounded direct loopback requests.
- `packages/installer/src/verify-manifest.ts` - exact signed-envelope recovery from private verified brands.
- `packages/persistence/src/runtime-status.ts`, `packages/application/src/policy.ts` - open-generation final projection and operation-bound candidate policy.
- `scripts/install/selfcheck.mjs` - installer-bound verified observations and normal-generation selfcheck support.
- `packages/test-support/src/upgrade-fixture.ts` - test-only actual compiled A/B and native lifecycle fixture; it is excluded from delivery evidence.
- `tests/integration/upgrade-journal.test.ts`, `upgrade-recovery.test.ts`, `managed-cleanup.test.ts`, `install-preview.test.ts` - durable boundaries, real upgrade/rollback/CLI, refusal, cleanup, and compatibility regression coverage.

## Decisions Made

- A completed SQLite backup is the only restore source. The implementation never copies a live main DB and never treats WAL as disposable; it closes owned connections, checkpoints and changes journal mode through SQLite, then requires WAL/SHM absence before atomic restore.
- Journal timestamps use the wall clock only for truthful observation values and `performance.now()` for bounded deadlines. A stalled or rolled-back wall clock fails rather than inventing a future timestamp.
- The same bearer-derived response proof used by the Plan 06 client is only a consistency binding after native PID/executable/listener verification; it is not documented as an independent server-secret proof or a replacement for native ownership.
- Candidate API/Worker processes capture an immutable generation. Exiting maintenance increments the generation, the candidates actually exit, and a fresh normal pair must start and pass another probe. Plan 10/14 must preserve this behavior in packaged/native evidence.
- Old program bytes may remain only behind a protected `inactive_rollback_artifact` receipt. Old active launchers, process receipts, startup references, mixed pins, or unknown host state prevent completion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Added native-owned MCP admission receipts and trusted cross-tree installer endpoints**
- **Found during:** Task 1
- **Issue:** An upgrade racing an unregistered old MCP host, or a staging installer assuming its own compiled API path, could not safely prove host quiescence or reach the installed target.
- **Fix:** Added protected nonsecret host leases, admission locking, exact installed-entry verification, and an installer-only frozen endpoint brand. No MCP parameter or public status output exposes PID, nonce, or real path.
- **Committed in:** `50fdf3c`

**2. [Rule 1 - Bug] Prevented failure projections from bypassing or losing the live authenticated API path**
- **Found during:** Task 2
- **Issue:** The draft failure catch always attempted direct DB projection and swallowed failure, even when a verified API remained live.
- **Fix:** Prefer the authenticated status-projection route, allow the DB adapter only after exclusive and process-exit proof, and persist `projectionWritten` plus a sanitized projection code in the failure receipt.
- **Committed in:** `0391c68`

**3. [Rule 2 - Security] Added exact activation-reality recovery and atomic restore mechanics**
- **Found during:** Task 2
- **Issue:** Recovering only the fully activated layout left torn rename boundaries unexplained, and copying a snapshot directly to the final DB path could leave a partial DB after interruption.
- **Fix:** Hash and classify all five rename boundaries before completing them; restore through a protected exclusive temp file, fsync, streaming hash, SQLite integrity/schema check, no-replace old DB isolation, atomic rename, directory fsync, and final hash verification.
- **Committed in:** `0391c68`

**4. [Rule 2 - Security] Wired production confirmation into the full upgrade engine**
- **Found during:** Task 2
- **Issue:** Plan 08 intentionally stopped at staging, so the actual installer CLI still returned a staged result after confirmation.
- **Fix:** Keep the CLI surface fixed, reverify any installed old envelope from bounded protected inventory, and enter `upgradeConfirmed` plus exact cleanup. `installConfirmed` remains explicitly stage-only for Plan 08 library tests.
- **Committed in:** `0391c68`

**5. [Rule 2 - Test correctness] Added an actual compiled A/B native upgrade fixture**
- **Found during:** Tasks 1 and 2
- **Issue:** Mock state machines could not prove launcher survival, native PID/listener ownership, Keychain lifecycle, real CLI/MCP/Worker/API jobs, generation exit, rollback restart, or cleanup.
- **Fix:** Added a test-only fixture that compiles current source into separate A/B trees, installs a private managed Node, uses fresh native UUID Keychain namespaces, and removes only exact entries after all owned PIDs are absent.
- **Committed in:** `0391c68` (helper extraction; the original actual chain landed in `50fdf3c`)

---

**Total deviations:** 5 auto-fixed (4 security/correctness, 1 test correctness). All were necessary to meet the approved recovery and ownership requirements; no product permission, dependency, public route, trust-key input, release, or Phase 2 scope was added.

## Issues Encountered

- The first Task 1 actual chain stopped at `reopened` because the API listener closed before the candidate PID had exited. Two subsequent runs also encountered transient native process-observation windows. Each fixture was preserved, its exact PID/start identity was rechecked, and its four Keychain entries/root were removed only after authenticated stop or actual absence. The final implementation waits up to 10 seconds for the immutable-generation candidate to become absent and never signals an unknown PID.
- The first Task 2 cleanup test hit its Vitest timeout and left one registered API. Subsequent cases correctly refused the occupied port. The exact root/active/runtime receipts were used to authenticate shutdown, verify both recorded PIDs absent, remove the four exact UUID keys, and remove only that fixture root before any new chain ran.
- The first actual CLI-upgrade attempt exhausted the API's real 30 authenticated requests/minute window after immediately following the A installation, so quiesce could not prove process ownership. The test now waits for the real rolling window before launching the sole CLI upgrade; the product rate limit was not weakened or bypassed. Teardown similarly uses a bounded same-identity retry window.
- An early fixture selected the first installation's snapshot/activation instead of the current operation. Tests now bind every fault to the exact journal operation and verify the injected `FAULT_INJECTED` receipt so an unrelated failure cannot masquerade as evidence.

## Automated Evidence

- Executor directed evidence:
  - actual durable A-to-B transaction plus boundary/policy/lifecycle tests: 30 targeted tests passed; TypeScript passed.
  - safe rollback: 1/1 passed in 48.52s.
  - unsafe recovery branches (`new_write`, schema, current-operation snapshot hash, old signature, unknown host receipt, unknown process ownership): 1/1 parameter loop passed in 222.43s with fixed post-fault DB bytes preserved.
  - no previous installation: 1/1 passed in 2.81s with four long-term keys and data retained.
  - cleanup success: 1/1 passed in 40.32s; cleanup-pending branches passed, including a separately rerun access-denied case in 40.25s.
  - real live host lease and controlled PID/start mismatch: 1/1 passed in 0.499s; both owned children were observed exited before receipt/root cleanup.
  - production compiled CLI full upgrade: 1/1 passed in 112.17s after the real rate window.
  - import boundaries plus install-preview compatibility: 8/8 passed; TypeScript `--noEmit` passed.
- Independent final regression: **141/141 Vitest tests passed** across 26 files in 767.96s; **10/10 UI tests passed** in 3.6s; `tsc --noEmit` exited 0; the production build exited 0 with four actual entries and identity `85a63e99677c132bfaa34c0fe76e3e1e97b781eccaa54d8af1eea0b2c7593c81`. No release or tag was created.

These are synthetic/integration/macOS-native local installation tests. They do not prove a published artifact, a production release trust root, a school login, a current long-lived Codex MCP host reload, or Windows native behavior.

## Known Stubs

- Production `verifyRelease` remains fail-closed with `RELEASE_TRUST_NOT_ESTABLISHED`. Plan 12 must establish the approved fixed public trust root; no real private release key was generated here.
- Windows PowerShell parent/Node child EOF and native ownership behavior remains `not_run`. A parent PowerShell exit cannot be treated as proof that its Node MCP child exited; Plan 14 must supply native Windows evidence.
- A pre-Plan-09 host without a protected lease remains unknown. A newly spawned MCP selfcheck proves only that process, not that the user's long-lived Codex host reloaded or an old resolver-host process exited.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: recovery-write | `packages/installer/src/recovery.ts` | Restores an owned SQLite DB and launcher set only after signature, snapshot, generation, schema, process, host, and path checks. |
| threat_flag: process-inventory | `packages/platform/src/client-host.ts` | Stores bounded nonsecret per-install MCP host leases for cleanup; does not enumerate machine processes or expose records to model/UI outputs. |
| threat_flag: installer-composition | `packages/installer/src/install.ts` | Confirmed production CLI now enters the full upgrade engine with no new public control arguments. |

## User Setup Required

None. No login, OS permission prompt, publication, release-key action, Profile, or school access occurred in this plan.

## Next Phase Readiness

- Plan 10 may assemble the verified program/Node/browser/installer closure and exercise the same transaction from packaged locations. It must not substitute the test-only parent `node_modules` link for a deliverable dependency closure.
- Upgrade controller discovery for an old installed build must come from its verified inventory/controller, never from a model-selectable `expectedEntry`. Active hash, Node hash, resolver hash, launcher pins, and any host registration update must remain one journaled update set.
- A fresh normal API/Worker pair after maintenance is mandatory. Candidate selfcheck success before generation exit is insufficient for upgrade completion.
- Plan 10/14 must inspect actual old long-lived MCP hosts, including resolver-host argv shapes and Windows PowerShell child processes; a new spawned MCP probe does not prove the host application reloaded.
- Windows native, real packaged installation, release trust, published beta availability, and human UAT remain `not_run`/pending. No Phase 1 requirement is marked complete by this plan alone.

## Self-Check: PASSED

The four task commits exist, every listed created file exists, the summary contains the independent final regression, and no source or root-owned planning document is staged with this summary.

---
*Phase: 01-beta*
*Completed: 2026-08-27*
