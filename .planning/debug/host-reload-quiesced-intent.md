---
status: verified
trigger: "Published beta.8 A-to-B upgrade stops with HOST_RELOAD_REQUIRED_QUIESCED_INTENT after confirmation while Codex MCP hosts still use beta.7."
created: 2026-08-30T23:25:00+10:00
updated: 2026-08-31T00:54:00+10:00
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

## Eliminated

- hypothesis: beta.8 activated partially or replaced beta.7 launchers.
  reason: Journal never reached activated intent and active.json still binds the beta.7 build.
- hypothesis: Download/signature corruption caused the stop.
  reason: Journal completed download verification and stopped specifically on live client-host inventory.

## Resolution

- root_cause: Client-host inventory was checked after API/Worker shutdown and transition to exclusive maintenance. The failure correctly preserved a journal and lock, but normal upgrade admission rejected both, and the recovery implementation only handled post-activation rollback.
- fix: Check owned client hosts before any managed mutation. Add narrowly typed recovery for exact quiesced-intent and cleaned-intent failures. The latter reuses the verified snapshot rollback engine, requires unchanged write generation and signed old/target manifests, stops only owned processes, removes only exited/revoked runtime receipts, restores the old build, and probes it in maintenance and normal generations. Cleanup now waits a bounded interval for genuinely running hosts but rejects unknown ownership immediately.
- verification: Regression tests cover pre-mutation live-host refusal, quiesced-intent continuation, cleaned-intent installer dispatch, revoked selfcheck receipt cleanup, real verified rollback, delayed child exit, and unchanged fail-closed ownership cases. All automated gates pass. Live beta.9 recovery and a fresh repaired upgrade remain a required human terminal test after the next signed beta is anonymously available.
- files_changed: packages/installer/src/journal.ts; packages/installer/src/upgrade.ts; packages/installer/src/install.ts; packages/installer/src/recovery.ts; packages/installer/src/cleanup.ts; packages/test-support/src/upgrade-fixture.ts; tests/integration/two-build-upgrade.test.ts; tests/integration/upgrade-recovery.test.ts; tests/integration/managed-cleanup.test.ts
