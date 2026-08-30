---
status: verified
trigger: "Published beta.8 A-to-B upgrade stops with HOST_RELOAD_REQUIRED_QUIESCED_INTENT after confirmation while Codex MCP hosts still use beta.7."
created: 2026-08-30T23:25:00+10:00
updated: 2026-08-31T04:46:00+10:00
---

# Debug Session: HOST_RELOAD_REQUIRED_QUIESCED_INTENT

## Symptoms

- Expected behavior: A published beta.7 to beta.8 update either asks the user to exit/reload Codex before mutating the installation, or safely resumes after the owned old MCP hosts have exited.
- Actual behavior: After confirmation and artifact verification, the installer enters exclusive maintenance, stops API/Worker, detects live old MCP hosts, writes a failure receipt, and exits without an exposed resume path.
- Error messages: `HOST_RELOAD_REQUIRED_QUIESCED_INTENT`; projection code `OFFLINE_EXCLUSIVE`.
- Timeline: First observed on 2026-08-30 during real native macOS beta.7 to beta.8 UAT.
- Reproduction: Keep Codex open with registered beta.7 MCP hosts, run the signed beta.8 bootstrap against the active root, confirm scope, and wait for the quiesced stage.

## Current Focus

- hypothesis: Confirmed root cause: host inventory was checked only after durable exclusive maintenance, but retry required an open gate and absent update lock; the documented reload action therefore had no continuation path.
- test: Require live owned client hosts to fail before journal/maintenance mutation, and allow only the exact pre-activation `quiesced/intent` state to restore its fence and continue after all hosts exit.
- expecting: Live-host preflight leaves the gate open and creates no update lock; exact interrupted state resumes to a complete target upgrade; altered fence, write generation, journal, active build, host or process evidence still fails closed.
- next_action: Ask the user to run the simplified beta.15 bootstrap once. It must resume beta.13 cleanup and continue to beta.15 in the same confirmed invocation; then verify status, echo, cleanup and the actual build.
- reasoning_checkpoint: Live operation `41aa02c0-3b8a-48e5-9334-d19728f56615` is preserved. Active beta.7 and data remain present; API/Worker are stopped; three old MCP hosts remain owned by Codex. Do not delete the lock, edit SQLite, kill hosts, or rerun bootstrap blindly.
- tdd_checkpoint: Two regressions pass: fail-before-mutation with a live client host, and exact quiesced-intent recovery through a complete A-to-B upgrade.

## Evidence

- timestamp: 2026-08-30T23:19:50+10:00
  observation: Journal reached `download_verified/done` then `quiesced/intent`; no `quiesced/done`, snapshot, migration, activation, or cleanup entry exists.
- timestamp: 2026-08-30T23:20:00+10:00
  observation: Failure receipt records operation `41aa02c0-3b8a-48e5-9334-d19728f56615`, `HOST_RELOAD_REQUIRED_QUIESCED_INTENT`, generation 1, write generation 15, and a successful offline-exclusive projection.
- timestamp: 2026-08-30T23:21:00+10:00
  observation: `active.json` still identifies beta.7 build `90710a...`; beta.8 build `a8b72d...` is staged but not active. API/Worker are stopped and three beta.7 MCP launcher processes remain.
- timestamp: 2026-08-30T23:23:00+10:00
  observation: Source inspection confirms host checking occurs inside the quiesced step after entering exclusive maintenance. A new upgrade rejects non-open maintenance and `UpgradeJournal.create` rejects the preserved update lock; no public resume command exists.
- timestamp: 2026-08-30T23:37:00+10:00
  observation: New regressions pass: a real live owned client host returns `HOST_RELOAD_REQUIRED_PRECHECK` with the database gate still open and no update lock, while an exact synthetic quiesced-intent failure restores the old fence and completes the next signed upgrade.
- timestamp: 2026-08-30T23:54:00+10:00
  observation: Full repaired gates pass: typecheck, 43 unit tests, 114 integration tests, 12 native macOS tests, 10 Playwright UI tests and production build. No live installation mutation was performed by these tests.
- timestamp: 2026-08-31T00:03:00+10:00
  observation: Immutable beta.9/beta.10 were signed and published under the isolated returdex identity with 18 assets each. Anonymous full-download verification passed all 36 assets, including byte length, SHA-256, release signatures and exact archive closure. Live recovery/update remains human_needed.
- timestamp: 2026-08-31T00:12:00+10:00
  observation: The real beta.9 retry activated and feature-verified the target but stopped at `cleaned/intent` with `CLEANUP_PENDING_CLEANED_INTENT`. All recorded client hosts subsequently inspected as exited, identifying a race between selfcheck child exit and the single cleanup observation.
- timestamp: 2026-08-31T00:54:00+10:00
  observation: The second repair adds exact cleaned-intent dispatch into the verified snapshot rollback engine, removes only revoked runtime receipts after all owned processes and hosts prove exited, and bounds cleanup waiting without accepting unknown ownership. Full gates pass: typecheck, 43 unit, 115 integration, 12 native macOS, 10 UI, and production build.
- timestamp: 2026-08-31T01:00:00+10:00
  observation: Immutable beta.11/beta.12 were published with 18 assets each. Anonymous full-download verification passed all 36 assets, including byte length, SHA-256, release signatures and exact archive closure. Live beta.9 recovery and fresh beta.11 upgrade remain human_needed.
- timestamp: 2026-08-31T01:30:00+10:00
  observation: Live beta.11 restored beta.7 launchers and the snapshot, then failed its operation-bound rollback selfcheck. The restored database remained exclusive at generation 2/write generation 15, but its lease expired at 2026-08-30T14:12:54.640Z, about 78 minutes before retry. Selfcheck projection recorded jobId null, empty probes and featureResult fail; beta.7 API/Worker were left running in the operation context.
- timestamp: 2026-08-31T01:36:00+10:00
  observation: New regressions pass for an expired exclusive recovery lease and for interruption after the old-active rollback boundary followed by exact resumption. The implementation renews only an unchanged installer-owned exclusive fence, preserves displaced recovery-attempt databases, and reports the bounded internal recovery cause instead of only HUMAN_RECOVERY_REQUIRED.
- timestamp: 2026-08-31T02:24:00+10:00
  observation: Final gates pass after also bounding transient macOS process-observation failures: typecheck, 43 unit tests, 117 integration tests, 12 native macOS tests, 10 UI tests and production build. The full integration rerun, not the earlier failed run, is the release evidence.
- timestamp: 2026-08-31T02:31:00+10:00
  observation: Immutable beta.13/beta.14 were published with 18 assets each. Anonymous full-download verification passed all 36 assets, including byte length, SHA-256, release signatures and exact archive closure. Live old-active recovery and fresh beta.13 upgrade remain human_needed.
- timestamp: 2026-08-31T03:17:00+10:00
  observation: The real beta.13 upgrade again reached activated and feature-verified, then failed within one second of `cleaned/intent` as `CLEANUP_PENDING_CLEANED_INTENT`. The seven recorded MCP clients later inspected as exited; the immediate failure excludes the bounded running-host wait and points to an ownership classification failure during the first observation.
- timestamp: 2026-08-31T03:29:00+10:00
  observation: Process identity analysis identifies the repeated root cause: a stale MCP receipt PID can be reused by an unrelated process. The inspector labelled the proven PID/start/executable mismatch as unknown, so cleanup failed closed. The correct terminal state is replaced: remove only the stale AutoED receipt and never signal the unrelated replacement process.
- timestamp: 2026-08-31T04:02:00+10:00
  observation: The third repair passes typecheck, 43 unit tests, 117 integration tests, 12 native macOS tests, 10 UI tests and production build. Regressions prove a live owned host still blocks, a PID-reused stale receipt is removed without stopping the replacement, cleanup is idempotent, and exact cleaned-intent recovery completes the feature-verified target without another download. The bootstrap now supports a default protected cache and an explicit root in one invocation.
- timestamp: 2026-08-31T04:09:00+10:00
  observation: Immutable beta.15/beta.16 were published with 18 assets each. Anonymous full-download verification passed all 36 assets, including byte length, SHA-256, release signatures and exact archive closure. The beta.15 macOS bootstrap SHA-256 is f435868bc78f3600ecc8112a3c26954a6156db3ae41421688b2801caf75cab4f. Real beta.13 cleanup continuation and beta.15 upgrade remain human_needed.
- timestamp: 2026-08-31T04:20:00+10:00
  observation: Final state-machine review rejected beta.15 for this recovery path before user execution: it resumed cleanup after creating the newer preview, which would invalidate that preview before the subsequent upgrade. Recovery now occurs before the new preview and confirmation. Separate regressions pass for dispatch-before-preview/download and the real cleaned-intent target continuation. Beta.15/beta.16 remain immutable but must not be recommended for this retry.
- timestamp: 2026-08-31T04:40:00+10:00
  observation: Post-ordering-fix gates pass: typecheck, 43 unit tests, all 118 integration behaviors, 12 native macOS tests, 10 UI tests and production build. The first full integration run passed 117 behaviors and failed only the packaged-closure copy with ENOSPC; after removing the exact 3.1 GB obsolete release-build backup, that one test passed independently. No product assertion failed.
- timestamp: 2026-08-31T04:46:00+10:00
  observation: Immutable beta.17/beta.18 were published with 18 assets each. Anonymous full-download verification passed all 36 assets, including byte length, SHA-256, release signatures and exact archive closure. The beta.17 macOS bootstrap SHA-256 is 2cb7de7fb7c6f22776763497610e7e68cf6c2404b677bcc5356033b299a78b52. Real beta.13 cleanup continuation followed by beta.17 upgrade remains human_needed.

## Eliminated

- hypothesis: beta.8 activated partially or replaced beta.7 launchers.
  reason: Journal never reached activated intent and active.json still binds the beta.7 build.
- hypothesis: Download/signature corruption caused the stop.
  reason: Journal completed download verification and stopped specifically on live client-host inventory.

## Resolution

- root_cause: Three independent defects were exposed in sequence. Client-host inventory was originally checked only after exclusive maintenance; cleaned-intent had no public continuation; and, after those were repaired, a stale MCP receipt whose PID had been reused was incorrectly classified as unknown even though its start identity/executable mismatch proved that the recorded host had exited. That last classification caused the repeated immediate beta.13 cleanup failure.
- fix: Check owned client hosts before mutation; provide exact quiesced-intent and cleaned-intent continuation; classify a PID identity mismatch as replaced, remove only the stale installation-owned receipt, and never signal the replacement process. Cleanup is idempotent after writing the inactive rollback record and reports bounded cause codes. A retry now finishes the already feature-verified target and, when the requested manifest is newer, continues in the same confirmed bootstrap invocation. The macOS bootstrap accepts a protected default cache and `--root`, removing the separate cache creation/chmod and root prompt.
- verification: Regression tests cover pre-mutation live-host refusal, quiesced-intent continuation, dispatch-before-preview/download, cleaned-intent target completion, PID reuse without replacement-process termination, idempotent cleanup, expired recovery lease, interruption after old-active restoration, revoked selfcheck receipt cleanup, delayed child exit, transient process observation, and unchanged fail-closed write/schema/snapshot/signature/host/process cases. All automated gates pass, and beta.17/beta.18 passed anonymous public availability verification. The real installed beta.13 continuation remains a required human test; it is not claimed as passed.
- files_changed: packages/installer/src/journal.ts; packages/installer/src/upgrade.ts; packages/installer/src/install.ts; packages/installer/src/recovery.ts; packages/installer/src/cleanup.ts; packages/test-support/src/upgrade-fixture.ts; tests/integration/two-build-upgrade.test.ts; tests/integration/upgrade-recovery.test.ts; tests/integration/managed-cleanup.test.ts
