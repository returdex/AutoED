---
status: verified
trigger: "Published beta.8 A-to-B upgrade stops with HOST_RELOAD_REQUIRED_QUIESCED_INTENT after confirmation while Codex MCP hosts still use beta.7."
created: 2026-08-30T23:25:00+10:00
updated: 2026-08-31T02:31:00+10:00
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
- next_action: Commit the fully tested repair, build/sign/publish the next immutable beta pair, anonymously verify every asset, then provide the user the terminal-only closed-Codex recovery/update step.
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

## Eliminated

- hypothesis: beta.8 activated partially or replaced beta.7 launchers.
  reason: Journal never reached activated intent and active.json still binds the beta.7 build.
- hypothesis: Download/signature corruption caused the stop.
  reason: Journal completed download verification and stopped specifically on live client-host inventory.

## Resolution

- root_cause: Client-host inventory was checked after API/Worker shutdown and transition to exclusive maintenance. The failure correctly preserved a journal and lock, but normal upgrade admission rejected both, and the recovery implementation only handled post-activation rollback.
- fix: Check owned client hosts before any managed mutation. Add narrowly typed recovery for exact quiesced-intent and cleaned-intent failures. The latter now recognizes both candidate-active and old-active hash-pinned boundaries, revalidates unchanged exclusive/write-generation fences, preserves displaced databases, restores the signed snapshot idempotently, renews only the same installer-owned exclusive lease, and probes the old build in maintenance and normal generations. Cleanup bounds running and transient macOS observation waits but rejects unknown ownership. Recovery errors expose a bounded internal cause code.
- verification: Regression tests cover pre-mutation live-host refusal, quiesced-intent continuation, cleaned-intent installer dispatch, expired recovery lease, interruption after old-active restoration, revoked selfcheck receipt cleanup, delayed child exit, transient process observation, and unchanged fail-closed write/schema/snapshot/signature/host/process cases. All automated gates pass. Live beta.9 recovery from its now old-active boundary and a fresh repaired upgrade remain a required human terminal test after the next signed beta is anonymously available.
- files_changed: packages/installer/src/journal.ts; packages/installer/src/upgrade.ts; packages/installer/src/install.ts; packages/installer/src/recovery.ts; packages/installer/src/cleanup.ts; packages/test-support/src/upgrade-fixture.ts; tests/integration/two-build-upgrade.test.ts; tests/integration/upgrade-recovery.test.ts; tests/integration/managed-cleanup.test.ts
