---
status: investigating
trigger: "Authorized bounded R0 diagnosis and necessary repair after beta.50 R3 failed at integration-managed-cleanup; distinguish process-group observer timeout, execution, permission, and zombie states; identify the independent managed-cleanup nonzero exit; finish a fresh unnumbered R1 without selecting beta.51 or performing release, install, login, 02-15, or Phase 3 work."
created: 2026-09-14T12:00:00+10:00
updated: 2026-09-14T21:24:00+10:00
---

# Debug Session: beta.50 process observer and managed cleanup

## Symptoms

- Expected behavior: The fixed R3 chain reports a deterministic test result and the process-group observer distinguishes absent, live, zombie-only, timeout, execution, and permission outcomes with allowlisted diagnostics.
- Actual behavior: Formal beta.50 R3 passed typecheck 1/1 and unit 154/154, then `integration-managed-cleanup` stopped with `PRE_RUNNER / PROCESS_GROUP_OBSERVATION_FAILED`.
- Error messages: `PROCESS_GROUP_OBSERVATION_FAILED`; the first independent exact-file run later reached normal group observation but exited nonzero, while the second passed 7/7.
- Timeline: Began during the first formal beta.50 R3 on 2026-09-14. beta.50 is already permanently invalidated and its active selection is retired.
- Reproduction: Run the managed-runtime per-file integration command for `tests/integration/managed-cleanup.test.ts` through `runPhase2Detached`; preserve only bounded allowlisted diagnostics.

## Current Focus

- hypothesis: The 60257 persistent-session run was invalidated by controller-coordination clean-snapshot drift, not a source/test outcome: an uncommitted mandatory debug record was created after launch while a concurrent duplicate 60279 also existed.
- test: Commit the sanitized debug record after all exact owned processes are absent, confirm clean `HEAD`, and stop all repository writes before the controller launches the one replacement persistent R1.
- expecting: A clean committed identity prevents repeat final-snapshot contamination; the interrupted 60257 run remains unusable regardless of test progress.
- next_action: Report committed clean identity to the controller and make no further repository writes while its next R1 is active.
- reasoning_checkpoint:
    hypothesis: "When no `exit` event is emitted, `runPhase2Detached` never installs its existing close watchdog. Its timeout calls `terminate`, but an already-absent owned group makes both signals no-ops and leaves the only promise unsettled."
    confirming_evidence:
      - "The new R1 coordinator exceeded the focused command's declared 1200-second ceiling while childless, and its exact owned PID 68539 was later TERM-sent and exited."
      - "The source installs `closeTimer` only inside `child.once('exit', ...)`; `timeoutTimer` calls `terminate('timeout')`, which sends scoped signals but does not probe or settle."
    falsification_test: "A fake detached child that emits neither `exit` nor `close`, whose owned group probe returns `absent`, must remain pending after `timeoutMs` before the change and reject with the new terminal-event code after it."
    fix_rationale: "A bounded post-timeout re-probe of the exact owned group preserves ownership verification, rejects if the group remains or observation fails, and converts a missing terminal event into a finite fail-closed result."
    blind_spots: "The terminated historic coordinator cannot prove why Node lost both events; the regression proves the uncovered adapter path and the fresh R1 remains required to exercise real children."
- reasoning_checkpoint:
    hypothesis: "runPhase2Detached waits exclusively on `child.close`; when an owned child emits `exit`, its process group is verified absent, and Node never delivers `close`, no timer remains capable of settling the promise."
    confirming_evidence:
      - "The current R1 coordinator was idle in `uv__io_poll` while its exact managed-cleanup group was absent and no later stage record existed."
      - "The adapter registers its timeout only to signal the group and resolves its sole pending promise only from `child.once('close', ...)`; group verification is unreachable until that promise resolves."
    falsification_test: "A fake detached child that emits `exit` without `close` and whose group probe is `absent` must remain pending before the change, but reject with only `COMMAND_CLOSE_TIMEOUT` after the verified-group watchdog is added."
    fix_rationale: "Verifying the exact owned group on `exit` and then bounding the still-missing `close` event converts the lost-event wait into a fail-closed allowlisted runner error without accepting an unverified child, descendant, or output."
    blind_spots: "The historic child cannot be replayed, so the regression uses an injected event-emitting fake; real-child focused and complete R1 checks remain required after the source repair."
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
- timestamp: 2026-09-14T19:17:00+10:00
  checked: Active fresh R1 owned topology after `managed-cleanup` child exit, plus one-second macOS sample of its exact managed coordinator.
  found: Child group 18909 is absent while coordinator 13604 and its exact wrapper group 13589 remain live; no scan-stage record exists. The coordinator sample is idle in `uv__io_poll`, not executing synchronous scan/assembly code.
  implication: The precise stall is the pending `child.close` await in `runPhase2Detached` after child-group disappearance. The prior scan hypothesis is eliminated for this attempt; timeout signaling alone cannot settle a lost close event.
- timestamp: 2026-09-14T19:31:00+10:00
  checked: New fake-child close-event regression, full phase2 release-gates suite, and managed typecheck.
  found: Before the repair, a child that emitted `exit` with an absent owned group but no `close` remained pending and the regression failed RED. After the repair, the same case rejects with only `PRE_RUNNER / COMMAND_CLOSE_TIMEOUT`; release gates pass 52/52 and typecheck passes.
  implication: The close-watchdog mechanism is directly proven without weakening owned-group verification. Targeted real-child managed-cleanup verification remains required before the atomic source/test commit.
- timestamp: 2026-09-14T19:36:00+10:00
  checked: Standalone managed-cleanup under the exact managed Node runtime, after a failed host-Node setup attempt.
  found: The host-Node command used Node 26.0.0 and failed synthetic-sign setup because fixtures explicitly require Node 24.20.0; it is a runner setup failure, not a source failure. The explicit managed-Node invocation remained live past the bounded observation and created two exact test-owned synthetic services, all four identified test PIDs/groups were TERM-reclaimed and then absent without touching unrelated processes.
  implication: Neither standalone attempt is a valid focused-suite pass. This repeats the independently known fixture lifecycle hang, while the close-watchdog test itself is GREEN; its atomic repair can be committed and the single authorized R1 will provide the next release-grade outcome.
- timestamp: 2026-09-14T20:02:00+10:00
  checked: Complete current `runPhase2Detached` terminal-event control flow against the new childless R1 coordinator outcome.
  found: `timeoutTimer` only calls `terminate`; `terminate` only signals the exact group. The existing `COMMAND_CLOSE_TIMEOUT` timer is created exclusively after `child.once('exit')` completes owned-group verification.
  implication: A child that loses both `exit` and `close` after its group disappears has no remaining settling path. This is distinct from, and not covered by, the prior post-exit close watchdog.
- timestamp: 2026-09-14T20:06:00+10:00
  checked: Exact current process topology following coordinator PID 68539 exit.
  found: Orphaned integration Vitest PID 85667 and its worker PID 85668 remain in exact test-owned PGID 85629; two remaining synthetic service processes are rooted under the fixture-generated protected temporary root and share the worker as parent.
  implication: The R1 wrapper/coordinator can exit while the child-chain remains alive. Before source repair, only the repository-owned exact synthetic-process reclamation path may be used to stop these identified fixture-owned processes.
- timestamp: 2026-09-14T20:10:00+10:00
  checked: Repository-owned synthetic-process reclamation followed by an exact process-table check for the validated fixture root and PGID 85629.
  found: The managed reclamation command returned successfully; no validated synthetic service or member of the orphaned integration PGID remained.
  implication: Residual cleanup was limited to the declared disposable fixture ownership boundary. The incomplete R1 remains failed/incomplete; cleanup does not create an R1 result or release evidence.
- timestamp: 2026-09-14T20:12:00+10:00
  checked: New managed-runtime regression with a fake detached child that emits neither `exit` nor `close`, has an absent group, and reaches its 20ms declared timeout.
  found: RED: the runner remained `pending` after 50ms rather than rejecting `COMMAND_TERMINAL_EVENT_TIMEOUT`; the enclosing release-gates file was otherwise 52 passing / 1 failing.
  implication: This directly reproduces the missing terminal-event path. The repair target is the timeout callback, not the already-covered post-exit close watchdog.
- timestamp: 2026-09-14T20:16:00+10:00
  checked: First minimal implementation, focused managed release-gates verification.
  found: The new no-terminal-event regression became GREEN, but the existing real-child timeout case changed from `COMMAND_TIMEOUT` to `COMMAND_TERMINAL_EVENT_TIMEOUT` because immediate group verification raced normal child terminal events.
  implication: Immediate verification is too aggressive and is eliminated. The terminal-event watchdog must wait the bounded existing grace so normal timeout closure retains its established classification.
- timestamp: 2026-09-14T20:20:00+10:00
  checked: Managed focused release-gates suite and managed TypeScript typecheck after delaying the timeout terminal-event watchdog by the existing bounded close grace.
  found: GREEN: release gates pass 53/53, including the new no-terminal-event case, the prior post-exit missing-close case, and the ordinary real-child `COMMAND_TIMEOUT` case; typecheck passes.
  implication: The repair yields a finite classified result only after the normal terminal-event opportunity, preserving established timeout and ownership/closure behavior.
- timestamp: 2026-09-14T20:23:00+10:00
  checked: Minimal source/test diff and atomic Git commit.
  found: Only `scripts/release/phase2-rehearsal.mjs` and `tests/integration/phase2-release-gates.test.ts` changed; they were committed as `5fdf2ae` (`fix(release): bound missing child terminal events`).
  implication: The repair identity is fixed. This debug record is the only remaining local change before the one authorized fresh R1.
- timestamp: 2026-09-14T20:35:00+10:00
  checked: Sole fresh R1 after `5fdf2ae`, its exact owned wrapper/coordinator PIDs, current-identity attestation/stage records, and exact owned child topology.
  found: The attempt exceeded its declared 1200-second ceiling with only wrapper PID 21528 and coordinator PID 21596 remaining; no current-identity attestation, terminal stage record, test child, or synthetic service existed. TERM was sent only to exact owned coordinator PID 21596, which exited; wrapper PID 21528 subsequently disappeared.
  implication: This R1 attempt is incomplete and cannot authorize selection or later gates. The prior timeout terminal-event repair did not settle this distinct real ordering; diagnosis must identify the remaining adapter or orchestrator wait before any source change.
- timestamp: 2026-09-14T20:39:00+10:00
  checked: Parent-coordinator lifecycle and surviving exact owned process topology after the fresh R1 lost its controller result.
  found: At approximately 1,017 seconds, coordinator PID 21596 and outer PID 21528 disappeared together, while exact managed wrapper PID/PGID 1668 remained live, reparented to PID 1, with only its owned npm/Vitest/worker chain and validated fixture processes.
  implication: The new topology is incompatible with a coordinator-only unsettled child promise as the immediate terminal event. It makes an outer execution-session cutoff the leading falsifiable cause; source repair is not justified until launch/session evidence is checked.
- timestamp: 2026-09-14T20:44:00+10:00
  checked: Complete `runPhase2Detached` timeout/event ordering, exact remaining PGID 1668 membership, repository-owned R1 output artifacts, and current Git status.
  found: The timeout watchdog remains armed after a late `exit` and is not cancelled before its owned-group verification/terminal rejection; no tested source ordering explains the observed simultaneous controller/outer loss. The exact PGID 1668 has no remaining member. The two R1 captured-output files are zero bytes, no current-identity terminal receipt exists, and the only working-tree change is this debug record.
  implication: The runner-defect hypothesis is eliminated for this occurrence. The shared outer/controller loss with a formerly reparented detached wrapper is bounded evidence of execution-session interruption; it is neither an R1 pass nor a classified source/test failure and does not authorize a code repair or release progression.
- timestamp: 2026-09-14T20:48:00+10:00
  checked: Controller authorization and repository identity after the external-session diagnosis.
  found: The controller authorizes exactly one clean retry because the interruption had zero source/test/tool/artifact drift and the former exact owned group is absent; it requires a persistent PTY/unified outer lifetime of at least 3600 seconds while retaining internal fixed-step ceilings.
  implication: The retry is a differentiating runner/setup experiment, not a beta selection or release action. Its source identity must be recorded at launch and its terminal result assessed without retrying again.
- timestamp: 2026-09-14T20:50:00+10:00
  checked: Persistent PTY retry launch identity and exact current R1 coordinators.
  found: The requested PTY session is ID 4009, coordinator PID/PGID 60279, launched on clean commit `a71200ab521db9f9376f1b39cc3c493b96b7f768`. At the same observation time, another exact `phase2-rehearsal.mjs --run` coordinator PID/PGID 60257 existed under the same outer parent.
  implication: Concurrent R1 runs invalidate independent terminal interpretation until the controller identifies ownership and directs a scoped cleanup. No process is terminated by this debugger because the duplicate's ownership is not yet resolved.
- timestamp: 2026-09-14T21:24:00+10:00
  checked: Controller-directed termination and repository-owned cleanup following the contaminated concurrent R1 attempt.
  found: The active coordinator PID/PGID 60257 and detached exact group 41177 were TERM-scoped. The repository-owned synthetic-process reclamation completed; the named reparented fixture PIDs 52646 and 52822 and validated disposable root `autoed-synthetic-Gw2Vjv` are absent, and no R1 coordinator remains. The concurrent 60279 launch was an invalid setup duplicate with no terminal receipt or residual. The 60257 run cannot attest because this debug record became an uncommitted working-tree change after it launched.
  implication: This is controller-coordination/setup drift, not a release-tool/source/test classification and not an R1 result. The sole authorized next experiment must start only after this record is committed and the working tree is clean; no code change is justified.

## Eliminated

- hypothesis: beta.50 may be retained as one proven transient.
  reason: The formal and focused failures differed, so stabilization policy permanently invalidated beta.50.
- hypothesis: A signed or public beta.50 object must be recovered.
  reason: No R3 report, artifact, signature, tag, release, publication, or availability receipt exists.
- hypothesis: The fresh R1 passed after the debug record was committed.
  reason: The only post-commit R1 command log records a nonzero exit at `two-build-upgrade`, and the required current-identity R1 attestation was not written.
- hypothesis: The one authorized post-repair clean R1 completed successfully or established a new classified failure.
  reason: Its childless coordinator was terminated after more than 25 minutes without a final sanitized result, and no current-identity attestation or durable terminal classification was written.
- hypothesis: The current fresh R1 is stalled in synchronous scan or assembly work.
  reason: It has not reached the scan-stage record, its managed-cleanup child group is absent, and a direct coordinator sample is idle in Node event-loop polling.
- hypothesis: The `5fdf2ae` terminal-event watchdog failed because a late child `exit` cancels its timeout settlement timer.
  reason: Source inspection proves the timeout watchdog remains assigned until it settles or the promise finishes; the observed simultaneous outer/coordinator disappearance and reparented wrapper instead identify an external lifecycle cutoff.
- hypothesis: The persistent-session 60257 attempt can supply a clean R1 terminal result.
  reason: A debug-record change made after launch left the working tree dirty before its final snapshot, and a concurrent 60279 coordinator independently violated the one-run constraint; both were stopped and all exact owned residuals were reclaimed.

## Resolution

- root_cause: The observer previously collapsed process-group states, and the detached adapter subsequently had two independent missing-terminal-event waits: after `exit` without `close`, and after neither event. In the latter path, its declared timeout only sent scoped signals; when the exact group was already absent, no timer could settle the promise, allowing the R1 coordinator to outlive its ceiling while childless.
- fix: Return closed allowlisted process-group states, preserve bounded test-host closure, bound post-exit missing `close`, and now after timeout wait one bounded terminal-event grace before re-verifying the exact group and rejecting `COMMAND_TERMINAL_EVENT_TIMEOUT` if no event arrives.
- verification: The new no-terminal-event test was RED before repair (`pending` after timeout). After repair, managed release gates pass 53/53, including ordinary child timeout and both missing-event branches; managed typecheck passes. `5fdf2ae` is committed. The next required evidence is one fresh complete unnumbered R1; no prior incomplete R1 is a pass.
- files_changed: [scripts/release/phase2-rehearsal.mjs, tests/integration/phase2-release-gates.test.ts, tests/integration/managed-cleanup.test.ts]
