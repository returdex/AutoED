# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## beta50-process-cleanup — Detached R1 terminal-event and session-lifecycle failures
- **Date:** 2026-09-14
- **Error patterns:** PROCESS_GROUP_OBSERVATION_FAILED, COMMAND_CLOSE_TIMEOUT, COMMAND_TERMINAL_EVENT_TIMEOUT, R1 coordinator, managed-cleanup, external session cutoff
- **Root cause:** The detached runner had bounded missing-terminal-event defects; after those were fixed, later incomplete R1 attempts were caused by an external session cutoff and clean-snapshot coordination drift rather than a remaining runner defect.
- **Fix:** Bound the terminal-event paths, then run R1 from a clean persistent session whose outer lifecycle exceeds the fixed-step ceiling.
- **Files changed:** scripts/release/phase2-rehearsal.mjs, tests/integration/phase2-release-gates.test.ts, tests/integration/managed-cleanup.test.ts
---
