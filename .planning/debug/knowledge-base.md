# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## beta51-install-timeout — Aggregate interactive bootstrap deadline
- **Date:** 2026-09-15
- **Error patterns:** ETIMEDOUT, SIGTERM, post-INSTALL failure, missing stage, migrated identity with incomplete installation
- **Root cause:** The signed bootstrap imposed one 300-second timeout on the whole inherited-PTY installer child, so human confirmation time and every install stage shared one deadline; the wrapper then discarded the durable journal stage.
- **Fix:** Await the single interactive child without an aggregate deadline, retain bounded inner operations, emit allowlisted stage events, and require signed-manifest/journal-tip-bound single-use CONTINUE or ROLLBACK with confirmation-time revalidation.
- **Files changed:** packages/installer/src/archive-core.ts, packages/installer/src/install.ts, packages/installer/src/journal.ts, packages/installer/src/recovery.ts, packages/installer/src/upgrade.ts, scripts/install/bootstrap.ps1
---

## beta50-process-cleanup — Detached R1 terminal-event and session-lifecycle failures
- **Date:** 2026-09-14
- **Error patterns:** PROCESS_GROUP_OBSERVATION_FAILED, COMMAND_CLOSE_TIMEOUT, COMMAND_TERMINAL_EVENT_TIMEOUT, R1 coordinator, managed-cleanup, external session cutoff
- **Root cause:** The detached runner had bounded missing-terminal-event defects; after those were fixed, later incomplete R1 attempts were caused by an external session cutoff and clean-snapshot coordination drift rather than a remaining runner defect.
- **Fix:** Bound the terminal-event paths, then run R1 from a clean persistent session whose outer lifecycle exceeds the fixed-step ceiling.
- **Files changed:** scripts/release/phase2-rehearsal.mjs, tests/integration/phase2-release-gates.test.ts, tests/integration/managed-cleanup.test.ts
---
