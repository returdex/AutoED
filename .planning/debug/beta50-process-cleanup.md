---
status: verifying
trigger: "Authorized bounded R0 diagnosis and necessary repair after beta.50 R3 failed at integration-managed-cleanup; distinguish process-group observer timeout, execution, permission, and zombie states; identify the independent managed-cleanup nonzero exit; finish a fresh unnumbered R1 without selecting beta.51 or performing release, install, login, 02-15, or Phase 3 work."
created: 2026-09-14T12:00:00+10:00
updated: 2026-09-14T12:50:00+10:00
---

# Debug Session: beta.50 process observer and managed cleanup

## Symptoms

- Expected behavior: The fixed R3 chain reports a deterministic test result and the process-group observer distinguishes absent, live, zombie-only, timeout, execution, and permission outcomes with allowlisted diagnostics.
- Actual behavior: Formal beta.50 R3 passed typecheck 1/1 and unit 154/154, then `integration-managed-cleanup` stopped with `PRE_RUNNER / PROCESS_GROUP_OBSERVATION_FAILED`.
- Error messages: `PROCESS_GROUP_OBSERVATION_FAILED`; the first independent exact-file run later reached normal group observation but exited nonzero, while the second passed 7/7.
- Timeline: Began during the first formal beta.50 R3 on 2026-09-14. beta.50 is already permanently invalidated and its active selection is retired.
- Reproduction: Run the managed-runtime per-file integration command for `tests/integration/managed-cleanup.test.ts` through `runPhase2Detached`; preserve only bounded allowlisted diagnostics.

## Current Focus

- hypothesis: The first fresh R1 attempt stopped before tests because the active debug file is untracked, causing the snapshot's required clean-state identity check to fail. The R0 source repair remains verified.
- test: Commit the current persistent debug record as documentation, then rerun one fresh unnumbered R1 from the resulting clean source identity.
- expecting: The initial snapshot passes clean-state validation; any later failure identifies a real R1 boundary rather than controller documentation drift.
- next_action: Commit `.planning/debug/beta50-process-cleanup.md`, confirm a clean worktree, and rerun the managed R1 command once.
- reasoning_checkpoint:
    hypothesis: "The observer classification collapse causes R3's generic PROCESS_GROUP_OBSERVATION_FAILED because the runner cannot distinguish EPERM, timeout, or executable failure after a group probe."
    confirming_evidence:
      - "The implementation returns null for EPERM and every execFile failure."
      - "The only caller maps null to PROCESS_GROUP_OBSERVATION_FAILED at both post-close probe boundaries."
      - "The formal R3 failure was exactly PROCESS_GROUP_OBSERVATION_FAILED at managed-cleanup."
    falsification_test: "If the current observer already returns distinct values for permission, timeout, and execution failure, the explicit-state regression will pass before source changes."
    fix_rationale: "Returning closed allowlisted states and mapping each failure state at the runner boundary exposes the true observation failure without treating it as an absent group or weakening cleanup."
    blind_spots: "The direct managed-cleanup run did not complete inside this investigation window; its separate test-process hang still needs bounded fixture cleanup and repeated verification."
- tdd_checkpoint: red_pending

## Evidence

- timestamp: 2026-09-14T11:43:00+10:00
  observation: Formal R3 stopped at `integration-managed-cleanup` with allowlisted class PRE_RUNNER and code PROCESS_GROUP_OBSERVATION_FAILED.
- timestamp: 2026-09-14T11:43:00+10:00
  observation: Bounded exact-file diagnosis produced one nonzero test process after normal group observation followed by one 7/7 pass; no single transient was proven.
- timestamp: 2026-09-14T12:18:00+10:00
  checked: `scripts/release/phase2-rehearsal.mjs` and the complete `tests/integration/managed-cleanup.test.ts`.
  found: The observer uses `true|false|null`; both `EPERM` from group liveness and every `/bin/ps` failure become `null`, then map to the same runner code. The host-fixture test waits indefinitely for child exit in its cleanup path.
  implication: Observer classification has a direct diagnostic gap; the fixture must prove bounded child closure to rule out a separate nondeterministic test-process exit.
- timestamp: 2026-09-14T12:32:00+10:00
  checked: One direct managed-runtime managed-cleanup invocation.
  found: The test worker remained active beyond 170 seconds without a remaining synthetic service and did not emit a final result; its exact test-owned process group was TERM then KILL reclaimed.
  implication: This did not prove the test assertion cause, but confirms that the independent diagnostic must use bounded fixture-child closure and cannot be reported as a successful reproduction.
- timestamp: 2026-09-14T12:36:00+10:00
  checked: Explicit observer-state regression under the managed runtime.
  found: It failed RED with `expected true to be 'live'` in 351 ms.
  implication: The current boolean/null observer contract directly disproves the required distinguishable-state behavior and confirms the proposed minimal repair target.
- timestamp: 2026-09-14T12:41:00+10:00
  checked: Managed observer regression, typecheck, and targeted synthetic-host cleanup regression.
  found: Observer regression passed after the explicit-state mapping; typecheck passed; the exact host test passed 1/1 in 954 ms with six unrelated parameter cases skipped.
  implication: The repair preserves the targeted ownership/cleanup behavior and prevents an unbounded final host close in the independently exercised path.
- timestamp: 2026-09-14T12:44:00+10:00
  checked: Full `phase2-release-gates.test.ts` and injected detached-runner permission mapping.
  found: All 48 release-gate tests passed; the injected permission state produced `PROCESS_GROUP_PERMISSION_DENIED` rather than the generic observer code.
  implication: The runner-boundary mapping is directly verified, and the source/test repair was committed atomically as `24915d6`.
- timestamp: 2026-09-14T12:50:00+10:00
  checked: First fresh managed R1 invocation at source commit `24915d6`.
  found: It stopped before the fixed suites with sanitized `PRE_RUNNER / IDENTITY_INVALID`; the only worktree entry was this untracked active debug record.
  implication: This is controller-documentation clean-state drift, not an R1 product/test result. The next R1 must use a committed persistent record and a clean snapshot.

## Eliminated

- hypothesis: beta.50 may be retained as one proven transient.
  reason: The formal and focused failures differed, so stabilization policy permanently invalidated beta.50.
- hypothesis: A signed or public beta.50 object must be recovered.
  reason: No R3 report, artifact, signature, tag, release, publication, or availability receipt exists.

## Resolution

- root_cause: The process-group observer collapsed permission, timeout, execution, and invalid outcomes to a single null value, so the detached runner always emitted `PROCESS_GROUP_OBSERVATION_FAILED`; the manually spawned synthetic test host also had no bounded close proof.
- fix: Return closed allowlisted process-group states, map each failure state to an allowlisted runner code, treat zombie-only groups as closed, and bound the test-owned host's EOF/TERM/KILL close sequence.
- verification: Focused observer red→green, managed typecheck, targeted managed-cleanup host regression, and full release-gate 48/48 pass; the first R1 attempt was pre-suite clean-state invalid and a clean rerun is pending.
- files_changed: [scripts/release/phase2-rehearsal.mjs, tests/integration/phase2-release-gates.test.ts, tests/integration/managed-cleanup.test.ts]
