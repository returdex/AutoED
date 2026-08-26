---
phase: 01-beta
plan: "05"
subsystem: local-runtime
tags: [worker, sqlite, detached-processes, ownership, native, generation-fencing]
requires:
  - phase: 01-04
    provides: Authenticated API, SQLite sessions, durable jobs and status projections
provides:
  - Compiled A/B Worker execution through JobRunner and real SQLite
  - Independent API and Worker entrypoints with protected process records and authenticated control
  - Native process and listener ownership cross-checks, fresh HMAC proof and verified shutdown
  - Persistent uncertain-launch recovery intent and immutable API runtime generation
affects: [01-06, 01-07, 01-08, 01-09, 01-10, 01-14]
tech-stack:
  added: []
  patterns: [detached-unref-noIPC, OS-keyring-only credentials, authenticated owned shutdown, fixed-generation writes, protected launch intent]
key-files:
  created: [apps/worker/src/main.ts, packages/test-support/src/synthetic-provider.ts, tests/integration/worker.test.ts, packages/platform/src/processes.ts, apps/cli/src/lifecycle.ts, tests/integration/process-lifecycle.test.ts, tests/native/process-ownership.test.ts]
  modified: [apps/api/src/main.ts, packages/application/src/job-runner.ts, packages/application/src/policy.ts, packages/domain/src/model.ts, vitest.config.ts]
key-decisions:
  - "PID, OS creation time and lease expiry are never sufficient kill authority; require installation/role/build/nonce, canonical executable, native listener ownership and authenticated fresh proof."
  - "An unconfirmed launch retains a flushed protected intent and lock; repeated startup is refused until authenticated confirmation or actual recorded-process exit."
  - "API runtime generation remains immutable through transaction-level mutation context, not only HTTP admission."
  - "Maintenance candidates must be stopped and replaced by fresh-generation normal API/Worker processes after maintenance exit."
requirements-completed: []
requirements-referenced: [ARCH-01, JOB-01, DIST-01]
duration: approximately 21min
completed: 2026-08-27
---

# Phase 1 Plan 5: Independent Worker and Owned Process Lifecycle Summary

**Detached API/Worker processes execute real SQLite synthetic jobs, prove native process ownership before control, and fence stale runtime generations.**

## Performance

- **Started:** approximately 2026-08-27 02:09 AEST
- **Completed:** approximately 2026-08-27 02:30 AEST
- **Tasks:** 2/2
- **Files:** 12 implementation/config/test files, including the orchestrator-owned Vitest serialization change, plus this summary

## Accomplishments

- Worker constructs the existing `JobRunner` and SQLite stores, captures its generation once, reports its own compiled build every five seconds and does not promote itself to a replacement generation. Fatal loop errors terminate heartbeat reporting and close its database; they cannot become later healthy reports.
- Actual A and B builds execute in separate managed Node processes. A echoes literal input and durably fails digest with non-retryable `UNSUPPORTED_CAPABILITY`; B computes SHA-256 of UTF-8 input. The known `abc` vector is asserted independently. Input text is never interpreted as a URL or instruction.
- Quiescing prevents ordinary claims; exclusive mode permits only explicitly operation-bound candidate work. Old contexts cannot resume ordinary backlog after generation advancement. Graceful stop produces a fresh stopped observation; abrupt death retains the previous observation, which becomes stale without erasing durable results.
- API and Worker have actual standalone compiled entrypoints. Worker has an internal ephemeral `127.0.0.1` control listener; the API uses its selected `43187` endpoint. Both enforce exact Host/Origin rules, bounded input/rate limits, existing application authorization and sanitized errors. No unauthenticated control port is exposed.
- Supervisor uses absolute selected Node and entrypoint paths, `detached`, `unref`, ignored stdio, no IPC, `shell:false` and `windowsHide`. It neither registers nor invokes login items, launch agents, scheduled tasks or Run keys.
- Protected records bind installation, role, compiled build, PID, public launch nonce, OS creation identity, canonical executable, entrypoint and actual control port. Before transmitting a CLI bearer, bounded native queries confirm that the recorded PID owns the exact loopback listener and recheck OS identity. A fresh challenge must then receive the correct HMAC proof using the installation's OS-keyring API secret.
- Stop prefers authenticated HTTP control and verifies actual exit. Any signal fallback requires a fresh authenticated proof and all ownership checks; subsequent polling rejects PID reuse. Unknown processes, paths, nonces and creation identities are never killed.
- Startup is serialized with a protected launch lock. Flushed, atomically replaced intent records contain no secret and record a candidate PID and OS identity when obtainable. Timeout preserves evidence and blocks duplicate spawn. The candidate PID is recovery information, not signal authority.
- CLI lifecycle methods expose separate start/stop/diagnose operations. Actual CLI and MCP entrypoints remain owned by Plan 06.

## Task Commits

1. **05-1 RED: independent Worker behavior** — `39861b3`
2. **05-1 GREEN: Worker, synthetic provider and error contract** — `3b59d46`
3. **05-2 RED: detached lifecycle and native ownership** — `a281529`
4. **Supporting test serialization, orchestrator-owned** — `22ab551`
5. **05-2 additional RED: stale API generation writes and recovery fixture** — `427368a`
6. **05-2 GREEN: supervised runtime and generation fencing** — `d2bf53a`

RED runs failed as expected before implementation. The additional HTTP regression specifically observed an obsolete API accepting a write with HTTP 200 after maintenance exit; GREEN requires HTTP 409 `GENERATION_MISMATCH`.

## Verification Evidence

| Check | Evidence/platform | Result |
|---|---|---|
| Worker task command | I, actual compiled A/B processes and temporary SQLite | 3/3 pass |
| Lifecycle task command, final run | I, actual detached API/Worker, native synthetic credentials, temporary installation | 1/1 pass; approximately 16.4 seconds |
| Native process ownership task command | N, macOS 26.5.2 arm64 | 2/2 pass |
| Final independent complete suite | S/I/N, managed Node 24.20.0 on macOS arm64 | **87/87 pass: 37 unit + 41 integration + 9 native**, 33.45 seconds |
| Final independent `tsc --noEmit` | TypeScript 7.0.2 | pass |
| Final independent production build | Managed Node 24.20.0 | pass; **2 actual entries: API and Worker** |
| Native Windows process/keyring/listener execution | N, Windows 11 x64 | **not_run** |
| Actual Codex exit, user installation/update, official login and other live UAT | N/L | **not_run / human_needed**, later approved hard gates |

The independent build before the final source commit reported build ID `f3540203b73cffe3eabf7bf5e48431810d3ff3db716d6ac99bda480b419466f9`. This identifies that tested build, not a published beta or immutable release tag. The lifecycle fixture separately compiles actual code into an owned temporary root, injects its synthetic build identity and links only current approved dependencies for resolution; it is not final delivery-artifact acceptance. Plan 10 owns that acceptance.

The lifecycle test proves launcher exit while both real services remain running, same-identity reuse, authenticated durable digest execution, independent API/Worker stop states, model denial at the process-inspection endpoint, altered identity rejection, and zero requests reaching an unrelated listener. A deliberately unpublished owned child proves retained PID/intent, duplicate-start refusal and refusal to clear a lock while it is alive. A test-only release marker lets that child exit itself, with a separate hard lifetime bound; recovery verifies actual absence before clearing its lock. No unrelated process or browser is terminated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Required runtime contracts and composition]** The seven planned files needed narrow supporting changes: `UNSUPPORTED_CAPABILITY` in the existing runner allowlist; canonical executable in `ProcessIdentity`; actual API standalone composition, heartbeat and authenticated identity endpoint. The executable field is optional only for older typed callers; runtime ownership checks require it. The orchestrator approved these extensions. Commits: `3b59d46`, `d2bf53a`.

**2. [Rule 1 — Stale API generation write window]** A standalone API initially read the latest generation on every application mutation, allowing an obsolete process to write before its next heartbeat stopped it. An actual HTTP RED test proved the defect. The API now guards authenticated admission and passes its immutable startup generation through `ApiApplication` to SQLite; maintenance/projection requests cannot supply a newer generation to evade the runtime binding. Commits: `427368a`, `d2bf53a`.

**3. [Rule 3 — Fixed-port test isolation]** Independent native/integration files can legitimately use the selected API port, so concurrent files can interfere. The orchestrator set `fileParallelism:false` without changing the product's port rules. Commit: `22ab551`.

No dependencies, architecture choices, source-access permissions, release versions or remote settings changed. Phase-wide requirements remain pending.

## Issues Encountered and Recovery Evidence

- The first lifecycle run rejected ownership because macOS `lsof -Fp` also emits mandatory file-descriptor fields. The safe failure preserved the synthetic installation, process, credentials and launch intent. After strict parsing was corrected to accept only the expected PID and descriptor fields, the original process passed OS, listener and HMAC checks. It was stopped through authenticated control, actual exit was verified, and only that fresh UUID's four exact keyring entries and owned test root were removed. A native positive/wrong-PID/closed-port regression now covers the query behavior.
- A subsequent independent suite reported **86/87**, with a retained uncertain-launch fixture. Its cleanup error masked the original assertion; the original failure cause is therefore **not established**. The preserved intent did contain PID and OS identity. Recovery confirmed that candidate PID and the registered API had actually exited, cleared the exact launch lock and removed only its synthetic entries/root. The fixture's short fixed lifetime was replaced with an explicit test-only release marker and a hard upper bound; failure stage and sanitized original code are retained if cleanup must stop. The final independent suite passed 87/87. Neither failed run was relabelled as a pass.
- Early Worker GREEN corrections fixed a test cleanup return type and an invalid assumption about same-millisecond job ordering. No production ordering guarantee was invented.

## Security and Evidence Limits

- Production credentials stay in native OS keyrings and process memory, never argv, environment, files or model output. Tests use fresh random synthetic namespaces and delete only their exact entries after verified process exit; no credential enumeration is performed.
- macOS OS creation observations have native `ps` timestamp granularity and are never sufficient alone. The nonce is public correlation metadata, not an authentication secret. Native listener checks and HMAC proof are mandatory additional factors. This does not claim protection against a malicious same-user process or administrator.
- Windows CIM and `Get-NetTCPConnection` paths are implemented but were not executed here. macOS evidence is not Windows/WSL evidence.
- The ephemeral authenticated Worker listener and API identity route implement the planned T-01-08 process-control boundary; compiled feature/fence tests cover T-01-09. No additional school, remote, Profile, browser, arbitrary-JS or arbitrary-URL surface was introduced.
- No OS authorization prompt, official authentication action or user approval was synthesized. No persistent default installation, autostart entry, release key, remote repository or beta publication was created.

## Downstream Integration Notes

- `OwnedProcessSupervisor` requires the approved root selection, absolute managed Node and selected role entrypoints. `registered()` and process records are local lifecycle/recovery material; do not serialize their paths/PIDs/nonces into MCP or status output.
- `workerContext` is a trusted installer-only supervisor option written into a protected launch intent. It cannot be supplied through ordinary job requests. Stop an existing normal Worker before launching an operation-bound candidate; starting the same live identity does not promote its privileges.
- After maintenance exit advances the generation, candidate API/Worker processes are obsolete. Plan 09 must stop them, start normal processes with the fresh generation and perform new actual probes; a candidate selfcheck pass is not completed activation.
- Public pairing initiation/exchange routes retain their existing public boundary until the old API closes; the generation guard does not claim to reject every pairing request immediately. Any such session still cannot bypass the protected API generation guard or approve itself.
- Unconfirmed startup retains its lock and receipt. Authenticate a matching published process before confirming that launch, or use `confirmFailedLaunchExit` only after the recorded candidate is actually absent. Never infer exit from timeout or lease expiry.
- Keep API polling/probes within the existing 30 authenticated requests/minute limit. Status freshness and process liveness remain distinct.

## Known Stubs

None preventing this plan's goal. Explicit null/not-observed states are real observation states. The unchanged generic public API page is Plan 04's pairing shell; Plan 07 owns the approved UI. CLI/MCP entrypoints, full installer activation, final artifacts, Windows native evidence and actual user UAT retain their approved downstream ownership.

## User Setup Required

None for the completed automated work. Plan 12 release trust/necessary OS actions and Plan 14 actual user update/UAT remain hard human gates. Do not advance to Phase 2.

## Planning Ownership

Shared STATE/ROADMAP/REQUIREMENTS/VALIDATION changes remain assigned to the orchestrator. No phase-wide requirement is marked complete by this plan summary.

## Self-Check: PASSED

All seven created implementation/test files exist; all six task/support commit hashes resolve to commit objects. Final independent tests/typecheck/build passed as recorded, `git diff --check` passes, and no task commit deleted a tracked file. No generated/private runtime files are untracked.

**Metadata tooling note:** The documented positional `gsd-sdk query commit` invocation interpreted the summary path as part of the message and committed all then-pending planning changes in `1846f8a`: this summary plus the orchestrator's prepared PROJECT, ROADMAP and VALIDATION edits. No content was overwritten or reverted; the orchestrator was notified. STATE remains under the orchestrator's ownership. Subsequent narrow documentation commits use explicit Git staging.
