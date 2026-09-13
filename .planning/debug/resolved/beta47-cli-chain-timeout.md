---
status: resolved
trigger: "授权在当前 AutoED 本地项目执行 beta.47 R3 失败后的 bounded R0 诊断和必要修复，包括消除 CLI/client-wiring 长链负载超时及超时后的 fixture 清理级联，并完成修复提交后的 fresh unnumbered R1；允许源码、测试、发布工具及必要失效状态记录，不选择 beta.48、不签名、不发布、不安装、不登录、不推进 02-15/Phase 3。"
created: 2026-09-13
updated: 2026-09-13
---

# Debug Session: beta.47 CLI chain timeout

## Symptoms

- Expected: beta.47 R3 completes the fixed managed typecheck, unit, per-file integration, UI, native and sensitive-scan gate with zero skip/todo and no residual owned process.
- Actual: the first formal R3 and one fixed-runner diagnostic stopped in the integration prefix with an assertion-class failure at client-wiring. A later detached prefix reproduced a 60-second timeout in the first CLI lifecycle test, followed by `INVALID_INSTALLATION` while creating/cleaning the next fixture.
- Errors: `COMMAND_TEST_ASSERTION_FAILED_INTEGRATION_CLIENT_WIRING`; `Test timed out in 60000ms`; `INVALID_INSTALLATION` from provisioning-receipt cleanup.
- Timeline: first observed during beta.47 R3 on 2026-09-13 after the beta.46 two-build-upgrade correction and a complete fresh unnumbered R1.
- Reproduction: run the fixed per-file integration sequence in one managed detached runner; isolated client-wiring and ordinary-terminal prefix runs pass, while the fixed long-chain failure moves between CLI and client-wiring.

## Scope Boundaries

- beta.47 is consumed and must not proceed to R4/R5.
- Do not select beta.48, sign, publish, install, log in, access Moodle/EdStem or advance 02-15/Phase 3.
- Modify only source/tests/release tooling and necessary invalidation/state records; preserve legacy and user data.

## Current Focus

- hypothesis: Confirmed. The 15-second CLI adapter timeout is shorter than the sequential two-service lifecycle budget, and it rejects before observed child close; the 60-second outer chain timeout can therefore interrupt an active async fixture and overlap later cleanup/provisioning.
- test: Force a CLI child to ignore `SIGTERM`, then require bounded `SIGKILL`, observed `close`, zero active CLI children and successful fixture cleanup; repeat CLI/client-wiring together and run the complete fixed integration chain.
- expecting: The timeout error is returned only after the exact child is reaped, no fixture cascade occurs, and the fixed long chain passes without skip/todo.
- next_action: Commit the corrective source/tests/tooling/state, then run the authorized complete fresh unnumbered R1 from the clean commit.
- reasoning_checkpoint: beta.47 failed twice in the fixed sequence, while isolated fixed runner, isolated ordinary run and ordinary prefix all passed. Identity, source/tree/build, managed tools, keyring, remote coordinates and residual-process checks passed.
- tdd_checkpoint: forced non-terminating CLI regression passes and proves zero active owned CLI children before cleanup

## Evidence

- timestamp: 2026-09-13T19:10:00+10:00
  observation: Formal R3 created no test report and returned a wrapper-level generic failure before R4.
- timestamp: 2026-09-13T19:10:00+10:00
  observation: Corrected fixed-runner diagnostic reproduced `PRE_SOURCE / COMMAND_TEST_ASSERTION_FAILED_INTEGRATION_CLIENT_WIRING` and strict reclaimer found no residual AutoED process.
- timestamp: 2026-09-13T19:11:00+10:00
  observation: client-wiring passed 8/8 in an isolated ordinary run and also passed in an ordinary first-ten-file prefix.
- timestamp: 2026-09-13T19:20:00+10:00
  observation: A detached first-ten-file prefix passed the first eight files, then the first CLI test timed out at 60000ms; the second CLI test failed during fixture setup/cleanup with `INVALID_INSTALLATION`.
- timestamp: 2026-09-13T19:24:00+10:00
  observation: client-wiring alone under the same detached/piped process adapter passed, excluding detached mode by itself.
- timestamp: 2026-09-13T20:51:00+10:00
  observation: CLI 3/3 and client-wiring 8/8 passed together; the forced child ignored TERM, was scoped-killed, reached close, left zero active CLI children and allowed fixture cleanup.
- timestamp: 2026-09-13T21:10:00+10:00
  observation: The exact fixed per-file integration chain passed 400/400 with zero failed/skipped/todo and successful owned-root cleanup.

## Eliminated

- hypothesis: Isolated GitHub identity, signing key, PATH tool lookup or release dependency is the immediate R3 cause.
  reason: Managed environment/keyring/returdex preflight passed and R3 stopped before signing/publication.
- hypothesis: Source, tree or build identity drift caused the gate failure.
  reason: Commit, tree, source SHA-256 and build ID matched the beta.47 selection before and after failure.
- hypothesis: A persistent owned AutoED process is occupying the test boundary.
  reason: Strict reclaimer and process census found no owned residual after each stopped run.
- hypothesis: client-wiring always fails under detached/piped execution.
  reason: The isolated detached/piped run passed all 8 tests.

## Resolution

- root_cause: The synthetic CLI adapter used a fixed 15-second output timeout even though start/stop can sequentially consume two service bounds, then rejected immediately after TERM without proving child close. The containing 60-second CLI/client-wiring test ceilings did not cover the full multi-operation chain, allowing Vitest timeout to overlap unfinished fixture cleanup with later provisioning.
- fix: Separate bounded normal and lifecycle command budgets; on timeout send TERM, wait, escalate exact child to KILL, wait for close, and only then return `CLI_OUTPUT_TIMEOUT`. Give only the containing workflow tests honest aggregate ceilings and classify `CLI_OUTPUT_TIMEOUT` as `TEST_TIMEOUT` in the sanitized release reporter.
- verification: managed typecheck; reporter/release-gate 47/47; CLI 3/3 plus client-wiring 8/8 in one batch; fixed complete integration 400/400; all with zero skip/todo and successful cleanup.
- files_changed: packages/test-support/src/native-runtime.ts; tests/integration/cli.test.ts; tests/integration/client-wiring.test.ts; scripts/release/phase2-rehearsal-reporter.mjs; tests/integration/phase2-release-gates.test.ts; release invalidation/state/policy/AGENTS records.
