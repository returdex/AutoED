---
status: awaiting_human_verify
trigger: "Fresh unnumbered R0/R1 at 6c2adad stopped PRE_RUNNER because complete managed integration Vitest did not finalize after its only worker exited."
created: 2026-09-05T10:05:49Z
updated: 2026-09-05T11:51:34Z
---

# Debug Session: R1 Vitest coordinator hang

## Symptoms

- Expected behavior: `node scripts/dev/runtime.mjs npm run test:integration -- --run` completes under the managed runtime, reports a trustworthy final test count, exits, and permits R1 to continue.
- Actual behavior: the only Vitest worker exited, but the coordinator remained alive for more than five minutes and emitted no final result.
- Error/result: no trustworthy integration count or completion status was produced; the owned coordinator was terminated without accepting the run.
- Timeline: first observed during the fresh unnumbered R0/R1 recurrence started from commit `6c2adad` on 2026-09-05. Earlier historical rehearsals completed the integration suite, so this is treated as a bounded runner regression, not product or live evidence.
- Reproduction: execute the complete managed integration command from a clean repository after the R0 managed-runtime/build preflight. A focused reproduction must not access school sources, installed product data, Profile data or any public beta verifier.

## Boundary

- Diagnose and fix only the integration runner lifecycle/cleanup issue within approved 02-38 Task 0 scope.
- Do not weaken timeouts, ownership, cleanup, process-observation, failure classification or test coverage.
- Do not select or consume beta.40, write a rehearsal attestation before a complete pass, sign, publish, install, update, log in, access Moodle/EdStem, create L evidence, or advance 02-14/02-15/Phase 3.
- Use only owned test processes and sanitized diagnostics. Never inspect or terminate unrelated browsers or the user's installed AutoED runtime.

## Current Focus

- hypothesis: Confirmed — the apparent coordinator hang was an inadequate observation deadline in a serialized suite with expensive synthetic fixture construction, compounded initially by two strict synthetic-process ledger parser defects already fixed in `3968624`.
- test: The single authorized exact full integration observer has completed with final totals, exit 0, and a clean dedicated-group exit.
- expecting: Controller/human review may accept this as bounded runner diagnostic evidence only. It does not run R0/R1, create an attestation, select a beta, or advance any gate.
- next_action: Preserve this record and report the exact final result to the controller; await any required human verification without further test, release, update, source, or live action.

reasoning_checkpoint:
  hypothesis: "The ledger cannot reclaim stale generated synthetic services because it has two contradictory parsers: it rejects the six-token ps argv as two tokens and then rejects every valid synthetic-root suffix by requiring the prefix twice."
  confirming_evidence:
    - "The exact managed integration suite and a single integration file both fail before tests execute with SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED."
    - "After the exact-argv repair, the failure moves to syntheticRoot(), and a sanitized probe finds two candidate roots with canonical, prefix, directory and non-symlink invariants true but suffixValid false."
    - "The harness creates roots with mkdtempSync(prefix); syntheticRoot() applies /^autoed-synthetic-[A-Za-z0-9]+$/ to the already-prefix-stripped suffix, an impossible match."
  falsification_test: "After correcting only the suffix predicate, a generated synthetic root would still fail the name check, or a malformed/extra-prefixed suffix would be accepted."
  fix_rationale: "The correction accepts only the suffix that the harness actually generates while retaining the existing canonical-prefix, plain-directory and no-symlink controls; it does not broaden candidate discovery or process signalling."
  blind_spots: "The lost five-minute observation cannot be replayed from its original process; this repair proves and addresses the current deterministic cleanup blocker but does not alone prove a historical coordinator handle leak."

## Evidence

- timestamp: 2026-09-05T11:51:34Z
  observation: The one authorized exact `node scripts/dev/runtime.mjs npm run test:integration -- --run` observer completed in 1,036.593 seconds (17:16.593), below its 1,800-second finite ceiling. Vitest emitted final totals of 32/32 files and 362/362 tests; the command exited 0 and its dedicated owned group was absent after exit.
  implication: Complete automated integration coverage is now trustworthy. This verifies the bounded runner diagnosis but is not an R1 pass, rehearsal attestation, release action, beta selection, update, login, source access, or live evidence.

- timestamp: 2026-09-05T11:51:19Z
  observation: A third non-invasive snapshot found the exact full-suite managed-runtime child still active at 16:53 of the 30:00 derived ceiling. It remains the sole owned test group by controlled session history.
  implication: The single authorized full-suite observer remains under its documented bound. No intermediate output was inspected or disclosed, and no signal was sent.

- timestamp: 2026-09-05T11:45:37Z
  observation: A second non-invasive snapshot found the exact full-suite managed-runtime child still active at 11:11 of the 30:00 derived ceiling. It is the sole remaining owned test group by this session's controlled execution history; all preceding dedicated groups were confirmed gone.
  implication: The single authorized full-suite observer remains in scope and under its limit. No intermediate test output was read or disclosed, and no signal was sent.

- timestamp: 2026-09-05T11:38:55Z
  observation: A non-invasive owned-group snapshot found the exact full-suite managed-runtime child still active in its dedicated PGID after 04:29 of the 30:00 ceiling. The in-memory observer intentionally exposes no partial file count before the final Vitest summary.
  implication: The run remains within its derived limit and has not produced acceptable progress evidence or a terminal result. No signal was sent and no other process was inspected.

- timestamp: 2026-09-05T11:34:26Z
  observation: The integration project sets `fileParallelism: false`, so file work is serialized. Recorded observed durations total at least 1,164.527 seconds: the eight recovery scenarios 579.559, managed-cleanup 215.008, two-build-upgrade 188.136, upgrade-journal 46.163, worker 13.681, and the first two eight-file slices 121.980 seconds. Eleven additional files completed with final totals but their component durations were recorded only in aggregate summaries.
  implication: The one full-suite observer uses a finite 1,800-second ceiling: the 1,164.527-second measured lower bound plus 635.473 seconds of explicit allowance for those eleven completed-file durations, single-run fixture variance, final reporting, and teardown. This does not alter Vitest's configured test/hook timeouts or accept an incomplete run.

- timestamp: 2026-09-05T11:33:12Z
  observation: The exact unfiltered `worker.test.ts` run passed 1/1 file and 3/3 tests in 13.681 seconds under its configured 30-second allowance plus 60 seconds of observer headroom. It emitted the required final total, exited 0, and its dedicated owned group was absent after exit.
  implication: The authorized whole-file worker evidence is complete. The next and only remaining test action is one derived-ceiling execution of the exact full integration command.

- timestamp: 2026-09-05T11:32:46Z
  observation: The out-of-scope unfiltered upgrade-recovery observer was cancelled after 106.526 seconds by SIGTERM to its verified dedicated process group (PGID 53528) only. It produced no final totals; the owned group was confirmed absent immediately afterwards.
  implication: This is scope-cancelled and unaccepted, neither a pass nor a test defect. No exact unfiltered upgrade-recovery result is used in subsequent ceiling derivation.

- timestamp: 2026-09-05T11:30:24Z
  observation: The `runs the actual compiled CLI through the complete verified upgrade engine` scenario passed 1/1 in 107.994 seconds under its declared 300-second allowance plus 60 seconds of observer headroom. It emitted a final 1-file total, exited 0, and its dedicated owned group was absent after exit. All eight named upgrade-recovery scenarios are now individually green.
  implication: Their measured serial duration is 579.559 seconds: 51.126, 42.213, 51.647, 51.917, 52.159, 214.463, 8.040, and 107.994 seconds. The exact-file observer will use a derived 720-second ceiling, adding 140.441 seconds for variance plus reporter/teardown, rather than reusing the inadequate 540-second cutoff.

- timestamp: 2026-09-05T11:27:55Z
  observation: The `reports first-install failure without inventing a rollback or deleting data and credentials` scenario passed 1/1 in 8.040 seconds under its configured 30-second allowance plus 60 seconds of observer headroom. It emitted a final 1-file total, exited 0, and its dedicated owned group was absent after exit.
  implication: Seven of eight upgrade-recovery scenarios are individually healthy. Only the last compiled-CLI scenario remains before the whole-file rerun authorized by the checkpoint response.

- timestamp: 2026-09-05T11:27:39Z
  observation: The integration project config specifies `testTimeout: 30_000` and `hookTimeout: 30_000`; only explicit per-test values above those defaults apply to the remaining unannotated first-install scenario.
  implication: A 90-second observer ceiling preserves the configured test allowance and adds explicit finite setup/reporting/teardown headroom without weakening any test timeout.

- timestamp: 2026-09-05T11:27:24Z
  observation: The six-fixture `stops for human recovery when writes, schema, snapshot, signature, host or process ownership are not proved` fault matrix passed 1/1 in 214.463 seconds under its declared 480-second allowance plus 60 seconds of observer headroom. It emitted a final 1-file total, exited 0, and its dedicated owned group was absent after exit.
  implication: Six serial recovery fixtures are healthy but consume substantial bounded time. Combined with the five preceding single-fixture successes, this directly confirms aggregate fixture duration as the explanation for the consumed 540-second whole-file observer.

- timestamp: 2026-09-05T11:23:03Z
  observation: The `resumes an exact old-active rollback boundary after interruption without trusting mixed state` scenario passed 1/1 in 52.159 seconds under its declared 240-second allowance plus 60 seconds of observer headroom. It emitted a final 1-file total, exited 0, and its dedicated owned group was absent after exit.
  implication: The fifth of eight upgrade-recovery scenarios is individually healthy. The remaining fault-matrix scenario is the only one that creates six serial fixtures, making it the strongest direct aggregate-duration measurement.

- timestamp: 2026-09-05T11:21:44Z
  observation: The `renews an expired exclusive recovery lease before rollback selfcheck` scenario passed 1/1 in 51.917 seconds under its declared 180-second allowance plus 60 seconds of observer headroom. It emitted a final 1-file total, exited 0, and its dedicated owned group was absent after exit.
  implication: The fourth of eight upgrade-recovery scenarios is individually healthy; no in-scenario lifecycle failure has appeared in the continued bounded sweep.

- timestamp: 2026-09-05T11:20:32Z
  observation: The `resumes the feature-verified target and preserves archives and profile data` scenario passed 1/1 in 51.647 seconds under its declared 180-second allowance plus 60 seconds of observer headroom. It emitted a final 1-file total, exited 0, and its dedicated owned group was absent after exit.
  implication: The third of eight upgrade-recovery scenarios is individually healthy; no in-scenario lifecycle failure has appeared in the continued bounded sweep.

- timestamp: 2026-09-05T11:19:14Z
  observation: The `dispatches an exact cleaned-intent continuation before preview or download` scenario passed 1/1 in 42.213 seconds under its declared 180-second allowance plus 60 seconds of observer headroom. It emitted a final 1-file total, exited 0, and its dedicated owned group was absent after exit.
  implication: The second of eight upgrade-recovery scenarios is individually healthy; the former 540-second exact-file ceiling remains consistent with aggregate serial fixture cost rather than a demonstrated lifecycle hang.

- timestamp: 2026-09-05T10:05:49Z
  observation: R0/build/typecheck/unit 144/144/UI 34/34 completed; integration produced no final result, so native/closures/prompt/lifecycle/sensitive gates were not accepted and no attestation was written.
- timestamp: 2026-09-05T10:10:12Z
  observation: `scripts/dev/runtime.mjs` executes the managed npm command synchronously with inherited stdio and throws on a nonzero child status; it has no asynchronous return path once `npm` is launched. Vitest uses a serialized integration project with a run-scoped loopback port and one shared setup file.
  implication: an early runtime-wrapper return is not supported by the code; the focused reproduction must distinguish a coordinator-held handle from a test-worker or observation issue.
- timestamp: 2026-09-05T10:13:10Z
  observation: An exact managed integration command in a new owned process group exited in 10 seconds with status 1, not a hang. Vitest reported 32 failed files and `Tests no tests`; no group termination was required.
  implication: H1 is refuted for the current exact source/runtime. The immediate fault is a suite-wide pre-test failure, so the earlier claim that a completed worker left only its coordinator cannot be accepted without its lost diagnostic context.
- timestamp: 2026-09-05T10:15:18Z
  observation: A single managed integration file fails in shared setup before test import with the bounded code `SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED`. Static inspection shows `validate()` passes all whitespace-separated `ps args` tokens to `invocation()`, but `invocation()` rejects any array whose length is not exactly two.
  implication: H2 is supported and H3 is a concrete, falsifiable root-cause candidate: a recoverable synthetic-process record cannot reach the ownership checks or cleanup path.
- timestamp: 2026-09-05T10:17:44Z
  observation: The only caller of `invocation()` supplies the complete `ps args` split list. Its intended command grammar is six whitespace-safe tokens: executable, entrypoint, `--autoed-service`, installation, synthetic root, and UUID nonce.
  implication: Requiring exactly that grammar is a narrower and more secure repair than accepting arbitrary trailing tokens, and preserves all later identity checks.
- timestamp: 2026-09-05T10:21:28Z
  observation: After the exact-argv repair, the focused managed unit suite reaches `syntheticRoot()` rather than failing the token-count check, then fails closed with `SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED` before any test executes.
  implication: The argv defect was real but not sufficient; H3's fix correctly exposes a second strict identity failure. No pre-existing process was signalled.
- timestamp: 2026-09-05T10:23:51Z
  observation: A sanitized managed-runtime probe found two existing synthetic-service candidates. Both have six tokens, the expected marker position, canonical disposable roots, valid prefix, plain directory, no symlink and canonical equality; both fail only the root-name suffix predicate. The harness constructs its root with `mkdtempSync(join(tmpdir(), 'autoed-synthetic-'))`.
  implication: H4 is confirmed. The predicate applies a full-prefix regex to an already-prefix-stripped suffix, so no generated root can be considered owned even when every other strict invariant holds.
- timestamp: 2026-09-05T10:26:10Z
  observation: With both strict parser repairs applied, the focused managed unit suite passes 3/3 and a focused managed integration file passes 2/2 behavior tests. The prior setup error does not recur.
  implication: The ledger can now validate and clean the existing stale synthetic records through its unchanged ownership-gated path; exact-suite completion remains the final verification step.
- timestamp: 2026-09-05T10:28:42Z
  observation: The first bounded full-suite wrapper outlived this tool's initial output window; a subsequent sanitized topology check found no workspace Vitest process. Because the final status/count was not observed, that run is not accepted as verification.
  implication: The owned test process was not left running, but the exact suite must be rerun in a persistent terminal session before completion can be claimed.
- timestamp: 2026-09-05T10:31:54Z
  observation: A second owned full-suite group remained active at the initial 30-second observation and later had no remaining members. The terminal bridge again failed to return a final test status or count.
  implication: Two exact runs do not provide trustworthy completion evidence in this harness. They establish no lasting owned-process leak, but verification will use bounded batches with observable final results and will not claim an exact complete-suite pass.
- timestamp: 2026-09-05T10:33:07Z
  observation: Managed integration batch one passed 8/8 files and 109/109 tests in 16.08 seconds, including bootstrap, browser-provider, auth, artifact-assembly and build-identity coverage.
  implication: The repaired shared setup executes behavior tests and cleanly finalizes in a bounded group; continue coverage in independent bounded batches.
- timestamp: 2026-09-05T10:35:24Z
  observation: The next eight-file integration group stayed active past the terminal bridge's 30-second observation window and later left no workspace Vitest process. No final status/count was returned, so it is not accepted.
  implication: Reduce the remaining observable verification batches to four files; no enduring owned test process was observed.
- timestamp: 2026-09-05T10:38:15Z
  observation: The first four-file retry also exceeded the terminal bridge's observation window and later left no workspace Vitest process. Its final result is unobserved and unaccepted.
  implication: The focused regression and first observable batch remain the accepted test evidence. Do not infer a full integration pass from process exit alone.
- timestamp: 2026-09-05T10:40:06Z
  observation: Managed TypeScript typecheck passed. The process-ledger unit suite passed 3/3, and `git diff --check` found no whitespace errors.
  implication: The minimal repair is ready for an atomic code/test commit. Full integration final counts remain unobserved in the terminal bridge and are not represented as a pass.
- timestamp: 2026-09-05T10:41:03Z
  observation: Repository-local Git identity was verified as `returdex <73513006+returdex@users.noreply.github.com>`. The minimal code/test repair was committed as `3968624`.
  implication: The repair is isolated from release and runtime state. The unarchived debug session remains a truthful record of the incomplete full-suite observation boundary.
- timestamp: 2026-09-05T10:29:12Z
  observation: A detached managed-runtime observer ran the exact integration command for its fixed 75-second bound. It ended as `timed_out`, received SIGTERM only within its dedicated owned group, confirmed that group gone, and had no final Vitest file/test totals.
  implication: H5 produced trustworthy negative evidence: exact full integration still fails to finalize. This is a bounded runner lifecycle failure, not a successful R1 result; collect pre-timeout owned-process evidence next.
- timestamp: 2026-09-05T10:31:38Z
  observation: The 65-second snapshot from the second 75-second observer contained three owned Node/Vitest-group members, including one running process, and only one completed integration-file result. It had no final summary, then timed out and cleaned its owned group with SIGTERM.
  implication: H6 is supported but does not show a post-suite leak. The suite is likely blocked during a later file; identify the completed-file boundary with a sanitized verbose run before changing behavior.
- timestamp: 2026-09-05T10:36:23Z
  observation: The one permitted fresh detached observer ran the exact managed integration command for 75 seconds. It emitted no final Vitest file or test totals, timed out, and received SIGTERM only in its owned process group. Three group members were present at cleanup initiation; zero remained after SIGTERM.
  implication: The exact full integration command has no trustworthy completion count within the bound, but there is no lasting owned-group process leak. This is PRE_RUNNER verification limitation/failure evidence, not an R1 pass; the bounded task must stop without retrying or advancing any gate.
- timestamp: 2026-09-05T10:49:00Z
  observation: Per-file managed-runtime runs of artifact-assembly, auth-api, auth-persistence, auth-security-matrix, auth-worker, bootstrap, browser-provider and build-identity all exited 0 with final 1-file totals. They completed 109 tests cumulatively in 39.75 seconds; every dedicated owned group was absent after completion.
  implication: The alphabetical prefix through build-identity is neither individually blocked nor leaving a durable owned process. Continue boundary isolation with the next deterministic slice.
- timestamp: 2026-09-05T10:52:00Z
  observation: The next eight individually managed integration files (cli through live-checkpoint-workflows) all exited 0 with final 1-file totals: 65 tests cumulatively in 82.23 seconds. client-wiring completed 8 tests in 45.803 seconds, its owned group was gone, and no test in the slice timed out or omitted final totals.
  implication: H8 is strongly supported: 16 normal serialized file runs already total about 122 seconds, so a 75-second full-suite observer cannot distinguish a slow legitimate suite from a lifecycle hang. Complete per-file observation before selecting the derived full-suite ceiling.
- timestamp: 2026-09-05T10:55:00Z
  observation: In the third per-file slice, local-auth, manifest-verification, pairing, phase2-live-gate, phase2-release-gates, process-lifecycle and profile-ownership each exited 0 with final totals (78 tests cumulatively). managed-cleanup emitted no final totals within 65.118 seconds and was SIGTERM-scoped only to its dedicated group; the group was absent afterwards.
  implication: H9 is a concrete file-level lifecycle candidate. The timeout is not a durable orphaned process, and the next action is to find the in-file/hook boundary rather than infer a full-suite pass.
- timestamp: 2026-09-05T11:00:00Z
  observation: The first named managed-cleanup recovery-fixture scenario passed as 1/1 test in 42.599 seconds under a 210-second owned-group ceiling. It emitted a final 1-file total and its dedicated group was absent after exit.
  implication: H9 is refuted as stated. The previous 65-second file ceiling is not evidence of a blocked first scenario; test the remaining scenarios to establish whether the full file is normally longer than that ceiling.
- timestamp: 2026-09-05T11:04:00Z
  observation: The five parameterized managed-cleanup cleanup-pending cases passed as 5/5 tests in 181.085 seconds under a 210-second owned-group ceiling. They emitted a final 1-file total and the dedicated owned group was absent after exit.
  implication: H10 is confirmed for the first two portions of the file: the test's explicit 180-second allowance reflects real bounded work. A 65-second per-file observer necessarily creates a false timeout; measure the last scenario, then use a derived finite full-file ceiling.
- timestamp: 2026-09-05T11:05:00Z
  observation: The remaining managed-cleanup host-inventory scenario passed as 1/1 test in 3.300 seconds under a 60-second owned-group ceiling and its dedicated group was absent after exit.
  implication: All seven named scenarios are independently green. Their 226.984-second sum yields a derived 270-second exact-file ceiling with 43.016 seconds of explicit setup/teardown headroom.
- timestamp: 2026-09-05T11:09:00Z
  observation: The exact managed-cleanup run passed 1/1 file and 7/7 tests in 215.008 seconds under its derived 270-second ceiling; its owned group was absent after exit.
  implication: H10 is confirmed. The prior 65-second timeout was a false observer boundary caused by normal bounded cleanup coverage, not a test-runner lifecycle defect. Complete the remaining files with ceilings based on declared test bounds before deriving the exact-suite limit.
- timestamp: 2026-09-05T11:11:00Z
  observation: Per-file managed-runtime runs of release-gates, release-trust, source-adapters and static-assets all exited 0 with final 1-file totals (77 tests cumulatively) within their 90-second default-bound ceiling. Every dedicated owned group was absent after completion.
  implication: 28/32 exact integration files are now independently observed green. The remaining four declare 180- to 480-second test allowances, so their finite observers must respect those existing bounds rather than recreate the invalid 65-second cutoff.
- timestamp: 2026-09-05T11:15:00Z
  observation: The exact two-build-upgrade run passed 1/1 file and 9/9 tests in 188.136 seconds under its 540-second ceiling (declared 300-second bounds plus reporting headroom). It emitted a final total and its dedicated owned group was absent after exit.
  implication: 29/32 exact integration files are independently observed green. No high-bound file has exposed a lifecycle leak; continue individual observation of the remaining declared-bound files.
- timestamp: 2026-09-05T11:17:00Z
  observation: The exact upgrade-journal run passed 1/1 file and 6/6 tests in 46.163 seconds under its 240-second ceiling. It emitted a final total and its dedicated owned group was absent after exit.
  implication: 30/32 exact integration files are independently observed green. Continue with the single 480-second-bound file before the final worker file.
- timestamp: 2026-09-05T11:27:00Z
  observation: The one exact managed upgrade-recovery observer ran for its derived 540-second limit (declared 480-second test allowance plus 60 seconds). It emitted no final Vitest file/test totals, was SIGTERM-scoped only to its dedicated group at the ceiling, and the group was absent afterwards.
  implication: The exact file result is unaccepted. This is not evidence of an enduring process leak; isolate named scenarios next without retrying the exact file or advancing any R0/R1/release gate.
- timestamp: 2026-09-05T11:31:00Z
  observation: Static inspection finds eight named upgrade-recovery scenarios and 13 independent `createRecoveryFixture()` calls: seven standard scenarios create one fixture and the fault-matrix scenario creates six. Fixture setup compiles two synthetic releases through bounded TypeScript subprocesses before recovery assertions.
  implication: A 540-second file-wide ceiling may be below ordinary serialized fixture construction alone. This supports, but does not yet prove, the aggregate-duration branch of H11; begin scenario-level observation.
- timestamp: 2026-09-05T11:33:00Z
  observation: The first named upgrade-recovery scenario passed as 1/1 in 51.126 seconds under a 240-second ceiling and its dedicated owned group was absent after exit.
  implication: H11's aggregate branch is strongly supported. The test's 13 fixture constructions have a comparable lower-bound setup cost above 664 seconds before remaining recovery work, so the consumed 540-second exact-file cutoff cannot establish a runner lifecycle hang.
- timestamp: 2026-09-05T11:34:00Z
  observation: A filtered worker run passed 1/1 file and 3/3 tests in 11.157 seconds under its 90-second ceiling with a final total and no remaining owned group. Across the exact-file sweep, 31 files emitted final totals and clean exits; only the consumed upgrade-recovery exact observer lacks a final total.
  implication: The bounded evidence rules out a general Vitest coordinator leak and identifies the observer-bound computation as inadequate for serial fixture-heavy coverage. A new derived full-suite observation would be a separately authorized action, not an R1 pass or release action.

## Eliminated

- hypothesis: beta.40 selection or public-release failure
  reason: no candidate was selected, no public mutation occurred, and the failure happened inside unnumbered R1.
- hypothesis: H1 — the managed runtime wrapper returned early while a real coordinator retained a resource after test workers finished
  reason: the exact managed command exited nonzero within 10 seconds; no coordinator survived the bounded owned-process observation.
- hypothesis: H9 — managed-cleanup.test.ts has a runner/test lifecycle fault
  reason: its first named 180-second recovery-fixture scenario passed with a final result in 42.599 seconds and clean owned-group exit; the 65-second file cutoff could include normal remaining scenarios.

## Resolution

- root_cause: The synthetic process ledger has two contradictory identity parsers: it supplied a full six-token command to a two-token helper, and its root-name check repeated the already-stripped `autoed-synthetic-` prefix. Consequently, an otherwise strictly owned stale synthetic process could never reach owner-gated cleanup.
- fix: Replaced the contradictory command parser with an exact six-token grammar and corrected the root-name predicate to validate only the generated suffix. Both regressions reject extra command arguments and malformed/extra-prefixed root names.
- verification: Managed typecheck passed; process-ledger regression passed 3/3; per-file observation produced final totals and clean owned-group exits for 31/32 integration files. The formerly suspicious managed-cleanup file passed 1/1 file and 7/7 tests in 215.008 seconds under a derived ceiling. All eight named upgrade-recovery scenarios passed independently with final totals and clean groups; their 579.559-second serial duration demonstrated why the earlier 540-second exact-file observer was inadequate. The required exact unfiltered worker run passed 1/1 file and 3/3 tests in 13.681 seconds. Finally, the one authorized exact full integration command passed 32/32 files and 362/362 tests in 1,036.593 seconds under a documented 1,800-second ceiling (1,164.527 seconds recorded lower bound + 635.473 seconds explicit headroom), exited 0, and left no owned group. This is bounded automated runner diagnostic evidence, not an R1/rehearsal pass.
- files_changed:
  - packages/test-support/src/process-ledger.ts
  - tests/unit/process-ledger.test.ts
