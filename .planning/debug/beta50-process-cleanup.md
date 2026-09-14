---
status: investigating
trigger: "Authorized bounded R0 diagnosis and necessary repair after beta.50 R3 failed at integration-managed-cleanup; distinguish process-group observer timeout, execution, permission, and zombie states; identify the independent managed-cleanup nonzero exit; finish a fresh unnumbered R1 without selecting beta.51 or performing release, install, login, 02-15, or Phase 3 work."
created: 2026-09-14T12:00:00+10:00
updated: 2026-09-14T19:10:00+10:00
---

# Debug Session: beta.50 process observer and managed cleanup

## Symptoms

- Expected behavior: The fixed R3 chain reports a deterministic test result and the process-group observer distinguishes absent, live, zombie-only, timeout, execution, and permission outcomes with allowlisted diagnostics.
- Actual behavior: Formal beta.50 R3 passed typecheck 1/1 and unit 154/154, then `integration-managed-cleanup` stopped with `PRE_RUNNER / PROCESS_GROUP_OBSERVATION_FAILED`.
- Error messages: `PROCESS_GROUP_OBSERVATION_FAILED`; the first independent exact-file run later reached normal group observation but exited nonzero, while the second passed 7/7.
- Timeline: Began during the first formal beta.50 R3 on 2026-09-14. beta.50 is already permanently invalidated and its active selection is retired.
- Reproduction: Run the managed-runtime per-file integration command for `tests/integration/managed-cleanup.test.ts` through `runPhase2Detached`; preserve only bounded allowlisted diagnostics.

## Current Focus

- hypothesis: The childless coordinator could remain unclassified because the post-command sensitive scan runs synchronously in the coordinator and has neither a durable stage boundary nor a whole-stage timeout; the lost PID 54703 cannot be uniquely back-attributed because no such boundary existed.
- test: Add a regression that requires a durable allowlisted scan-stage record and execute the scan in an exact managed detached child bounded by a stage deadline.
- expecting: The regression is RED before the repair. Afterward, an overlong or invalid scan child produces only a normalized `SCAN_STAGE_*` failure and no R1 pass attestation; a successful child creates no external disclosure.
- next_action: Run exactly one fresh complete unnumbered R1 from clean committed identity `edab68a`; accept it only with exit 0 and a current-identity attestation, otherwise preserve its allowlisted terminal state without retry.
- reasoning_checkpoint:
    hypothesis: "PID 54703 was stranded in the coordinator's post-command synchronous scan boundary because scanPhase2RehearsalSources invokes synchronous history/tree scans without a stage record or stage-level timeout."
    confirming_evidence:
      - "The historical run has no final output, failure record, current-identity attestation, or durable per-stage record, so no old stage can be directly observed."
      - "After all fixed command children, production scan calls scanner.finish() and scanPhase2RehearsalSources synchronously; scanReachableHistory executes one bounded git child per reachable object but has no aggregate deadline."
      - "The coordinator was observed childless and live for more than 25 minutes, which is compatible with coordinator-only synchronous scan work and is not compatible with a final completed R1."
    falsification_test: "If the current runner already persists a stage before scan and runs that scan behind an independently bounded owned child, the new regression will pass before the repair."
    fix_rationale: "Persisting an allowlisted stage boundary and isolating the synchronous scan behind the existing owned detached-child adapter makes a future stall terminate as a classified failure without exposing scanned content or weakening scan results."
    blind_spots: "No retained stage evidence can prove which exact operation PID 54703 was in; the repair prevents recurrence and classifies future attempts rather than retroactively fabricating a diagnosis."
- reasoning_checkpoint:
    hypothesis: "The R1 orchestrator drops its only allowlisted failure category at process exit because it writes successful attestations only and returns the failure only via transient stderr."
    confirming_evidence:
      - "The historical R1 command record retains npm exit 1 at two-build-upgrade but no category or identity-matching attestation."
      - "runFixedCommand computes an allowlisted category and immediately throws it; writePhase2Rehearsal accepts only status: pass."
      - "The new focused regression is RED (exit 1) because the proposed persistent failure-record API is absent."
    falsification_test: "If a current R1 failure already writes a validated allowlisted-only record readable after completion, the red regression would pass before the repair."
    fix_rationale: "Persisting only the normalized class/code and completion timestamp after cleanup lets later bounded diagnosis distinguish the failed stage without retaining raw child output or weakening any failure gate."
    blind_spots: "The historical beta.50 child output is permanently unavailable, so this repair cannot retroactively determine whether that exact nonzero was assertion, timeout, incomplete run, signal, or generic exit."
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

- timestamp: 2026-09-14T14:16:00+10:00
  checked: One release-owned detached focused `two-build-upgrade` invocation configured to print only an allowlisted JSON result.
  found: The automation returned after 30 seconds with no sanitized result payload.
  implication: The test outcome is not yet interpretable; process ownership/liveness must be checked before a further experiment.
- timestamp: 2026-09-14T14:18:00+10:00
  checked: Exact process-table match for the wrapper's `two-build-upgrade` child after the empty automation response.
  found: No matching test-owned process remained.
  implication: No live process requires cleanup, but the invocation emitted no usable outcome; it cannot be used as a reproduction result.
- timestamp: 2026-09-14T14:24:00+10:00
  checked: Complete R1 orchestration and reporter paths plus current `.planning/release-rehearsals` records.
  found: `runFixedCommand` maps a nonzero child to an allowlisted class/code only in a thrown error. The only writer persists a successful `status: pass` attestation; no durable failed-command record exists.
  implication: The historic npm exit cannot be distinguished as assertion, timeout, incomplete run, signal, or generic exit after the runner terminates. This confirms the missing durable sanitized classification mechanism.
- timestamp: 2026-09-14T14:34:00+10:00
  checked: New one-test managed regression for a validated `COMMAND_TEST_ASSERTION_FAILED_TWO_BUILD_UPGRADE` failure record.
  found: RED, exit 1, with no child output exposed.
  implication: The regression accurately captures the absent durable-record capability and is ready for the minimal repair.
- timestamp: 2026-09-14T14:42:00+10:00
  checked: Managed red-to-green regression for an allowlisted-only failure record.
  found: GREEN, exit 0, after adding atomic record validation, a bounded reader, and the post-cleanup R1 failure-path write.
  implication: Future failed R1 runs retain a safe class/code diagnostic without retaining child stdout/stderr or converting a failure into a pass.

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
- timestamp: 2026-09-14T13:51:00+10:00
  checked: Repository-owned post-`da531b9` managed-runtime npm log, current Git identity, and R1-attestation directories; no command was rerun.
  found: The committed debug record left `git status --porcelain` clean. The fresh R1 invoked `npm run test:integration -- --run tests/integration/two-build-upgrade.test.ts` at the fixed focused boundary; npm recorded exit 1 at 2026-09-14T13:45:59+10:00. No `.planning/release-rehearsals` artifact newer than `da531b9` exists, and no attestation binds the current commit/tree.
  implication: Fresh R1 did not pass and must not authorize any candidate selection or later release/live action. Repository state proves a nonzero focused child at `two-build-upgrade`, but does not retain that child's sanitized final category, so no more-specific code is inferred.
- timestamp: 2026-09-14T18:34:22+10:00
  checked: The one authorized post-repair clean R1 coordinator's owned-PID outcome (54703), current repository status, and release-rehearsal attestation directory; no command or test was rerun.
  found: After remaining childless and live for more than 25 minutes without a final sanitized result, PID 54703 received TERM as the exact owned coordinator and exited. A subsequent exact PID check finds it absent; the working tree is clean and no newer current-identity R1 attestation exists.
  implication: This attempt is incomplete and blocked, not an R1 pass and not a classified product/test failure. Its termination confirms only scoped coordinator cleanup; it supplies no basis to retry the attempt, select beta.51, or progress any release/live gate.
- timestamp: 2026-09-14T19:02:00+10:00
  checked: Complete post-command production R1 path and retained coordinator diagnostics.
  found: No durable per-stage record existed for PID 54703. The production `scan` operation synchronously calls captured-output finalization plus tracked/history/working-tree scanning; history scanning invokes bounded git probes per object but lacks an aggregate stage deadline.
  implication: The historical PID cannot be uniquely attributed without inventing evidence. The scan boundary is a concrete, falsifiable coordinator-only stall candidate and requires a bounded child plus durable allowlisted progress for future classification.
- timestamp: 2026-09-14T19:06:00+10:00
  checked: New scan-boundary regression and managed typecheck.
  found: The regression was RED before implementation because the scan-stage API was absent. It is GREEN after implementation; an injected owned-child timeout records only `status: running, stage: scan` and returns `PRE_SOURCE / SCAN_STAGE_TIMEOUT`. Typecheck passes.
  implication: The repair has direct regression coverage for the missing classification boundary without accepting a timeout as success or retaining child output.
- timestamp: 2026-09-14T19:10:00+10:00
  checked: Complete release-gates regression, source diff, and clean committed identity.
  found: `phase2-release-gates.test.ts` passes 51/51; typecheck passes; the bounded scan repair is committed as `722e2b6` and the persistent debug update as `edab68a`; working tree is clean.
  implication: One fresh R1 is authorized on this identity. Any outcome without a current-identity pass attestation remains a failure/incomplete state and will not be retried.

## Eliminated

- hypothesis: beta.50 may be retained as one proven transient.
  reason: The formal and focused failures differed, so stabilization policy permanently invalidated beta.50.
- hypothesis: A signed or public beta.50 object must be recovered.
  reason: No R3 report, artifact, signature, tag, release, publication, or availability receipt exists.
- hypothesis: The fresh R1 passed after the debug record was committed.
  reason: The only post-commit R1 command log records a nonzero exit at `two-build-upgrade`, and the required current-identity R1 attestation was not written.
- hypothesis: The one authorized post-repair clean R1 completed successfully or established a new classified failure.
  reason: Its childless coordinator was terminated after more than 25 minutes without a final sanitized result, and no current-identity attestation or durable terminal classification was written.

## Resolution

- root_cause: The process-group observer collapsed permission, timeout, execution, and invalid outcomes to a single null value, so the detached runner always emitted `PROCESS_GROUP_OBSERVATION_FAILED`; the manually spawned synthetic test host also had no bounded close proof.
- fix: Return closed allowlisted process-group states, map each failure state to an allowlisted runner code, treat zombie-only groups as closed, and bound the test-owned host's EOF/TERM/KILL close sequence.
- verification: Focused observer red→green, managed typecheck, targeted managed-cleanup host regression, and full release-gate 48/48 pass. The first R1 attempt was pre-suite clean-state invalid; the subsequent clean R1 reached focused `two-build-upgrade` but its managed child exited 1 and no new attestation exists. The sole authorized post-repair clean R1 then remained childless and live for more than 25 minutes, was TERM-stopped only as exact owned PID 54703, and wrote neither a final sanitized result nor a current-identity attestation. R1 is therefore incomplete and not passed.
- files_changed: [scripts/release/phase2-rehearsal.mjs, tests/integration/phase2-release-gates.test.ts, tests/integration/managed-cleanup.test.ts]
