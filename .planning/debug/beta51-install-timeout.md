---
status: verifying
trigger: "授权在当前 AutoED 本地项目执行 beta.51 human-update 失败后的 bounded R0 诊断和必要修复，包括查明 INSTALL 确认后 ETIMEDOUT/SIGTERM 的精确阶段、为已完成身份迁移但未完成安装的状态提供签名绑定且幂等的恢复/继续/回滚流程，并改进阶段化脱敏诊断；允许源码、测试、发布工具及必要失效状态记录，并完成修复提交后的 fresh unnumbered R1；不得修改实际安装根、不得重跑 beta.51、不选择 beta.52、不签名、不发布、不安装、不登录、不访问或备份 Profile、不推进 02-15/Phase 3。"
created: 2026-09-15T00:35:00+10:00
updated: 2026-09-15T02:40:00+10:00
---

# Debug Session: beta.51 post-confirmation installation timeout

## Symptoms

- Expected behavior: After exact recovery and install confirmations in one live PTY, the signed updater either completes activation/readiness/cleanup or stops with a stage-specific, safely resumable failure that preserves data and exact ownership evidence.
- Actual behavior: Schema-1 identity recovery completed, then the same beta.51 bootstrap exited once with status 1 after the install confirmation. No installation-complete, readiness, or cleanup-complete record was emitted.
- Error messages: Sanitized external result contained only `ETIMEDOUT` and `signal: SIGTERM`; it did not name the failed install stage.
- Timeline: The single real beta.51 macOS arm64 projectless update attempt occurred after beta.51 passed R2-R5 and anonymous availability verification on 2026-09-15. The bootstrap was not rerun.
- Reproduction: Do not reproduce against the real installation. Use only repository-owned synthetic fixtures to exercise an already-migrated identity plus an interrupted post-confirmation upgrade.

## Current Focus

- hypothesis: A bounded child operation after INSTALL exceeded an outer timeout, while the bootstrap-to-installer error projection discarded the operation stage and the interrupted-update journal lacks a signed, idempotent resume/rollback decision contract.
- test: Trace every post-confirmation timeout and error projection from the signed bootstrap through installer orchestration, journal recovery, process transition, activation, readiness and cleanup; then construct a synthetic failing fixture at each candidate boundary.
- expecting: One exact stage should reproduce generic ETIMEDOUT/SIGTERM before repair; a regression must require an allowlisted stage code and prove idempotent continuation or rollback from the same signed selection without touching real runtime data.
- next_action: Inspect repository source and tests only; map timeout ownership, journal states and existing recovery invariants before changing code.
- reasoning_checkpoint:
    hypothesis: "Post-INSTALL timeout is collapsed before a durable stage/result can be emitted."
    confirming_evidence:
      - "External output contains ETIMEDOUT and SIGTERM but no installer stage."
      - "Recovery migration completed, so the timeout occurred after the first human gate and before an installation-complete/readiness/cleanup receipt."
    falsification_test: "If every post-confirmation child already persists a stage before execution and projects its exact allowlisted stage on timeout, this hypothesis is false and diagnosis must move to the projectless task controller."
    fix_rationale: "Persisting and signing the exact transition intent before mutation, then resuming or rolling back idempotently from that intent, prevents a generic timeout from forcing a fresh unsafe install attempt."
    blind_spots: "The real managed root is explicitly out of scope, so the exact historical internal stage must be inferred only where source contracts and synthetic reproduction uniquely support it; otherwise the record must state the ambiguity."
- tdd_checkpoint: green_focused

## Evidence

- timestamp: 2026-09-15T00:35:00+10:00
  checked: User-returned sanitized beta.51 updater result.
  found: Identity recovery completed; the sole bootstrap later exited 1 with ETIMEDOUT/SIGTERM and emitted no installation-complete, readiness or cleanup-complete record.
  implication: beta.51 is a permanent HUMAN_PRODUCT failure and cannot be rerun; diagnosis must use synthetic fixtures and a later signed candidate.
- timestamp: 2026-09-15T02:05:00+10:00
  checked: Exact release-local beta.51 macOS bootstrap bytes and matching repository source.
  found: The verified core wraps the interactive installer in `execFileSync` with `stdio: inherit` and `timeout: 300000`; Node reports this deadline as `ETIMEDOUT` and sends `SIGTERM`. Windows also wraps the core process in `WaitForExit(300000)`.
  implication: The exact terminating boundary is the bootstrap aggregate installer-child deadline. It incorrectly includes both human waits and the entire installation; it is not evidence that an inner stage timed out.
- timestamp: 2026-09-15T02:15:00+10:00
  checked: Bounded process-only observation; no managed-root file was opened.
  found: Two processes execute the beta.51 target program's API and Worker entries.
  implication: The update reached at least journal stage `started`; feature verification, cleanup, reopen and completion remain unproved without the out-of-scope journal. The earlier no-process claim is stale or incorrect.
- timestamp: 2026-09-15T02:35:00+10:00
  checked: Repository-only synthetic bootstrap and upgrade recovery fixtures.
  found: Typecheck passes. Focused tests pass for an unlimited interactive child, bounded sanitized child errors, explicit signed cleanup continuation, activated rollback, exact pre-mutation retirement, and post-reopen finalization continuation. A deliberately concurrent multi-file run caused fixture compilers to fail and is classified as runner saturation; the release lifecycle runs integration files serially.
  implication: The product correction is green at focused boundaries; the mandated serial fresh R1 remains the final proof.

## Eliminated

- hypothesis: The beta.51 attempt was only an invalid task-context refusal.
  reason: The projectless updater passed both human gates and completed installation-identity recovery before the post-INSTALL timeout.
- hypothesis: beta.51 can be retried because installation did not complete.
  reason: A signed installer invocation mutated the installation identity and then failed; the immutable published human-update attempt is consumed.

## Resolution

- root_cause: "The signed beta.51 bootstrap imposed a 300-second aggregate timeout on the same interactive installer child that owned two human gates and all install stages. It sent SIGTERM after INSTALL; the wrapper surfaced only ETIMEDOUT/SIGTERM and discarded the journal stage."
- fix: "Await the one inherited-PTY installer child without an aggregate human deadline on macOS and Windows; keep internal bounded operations; emit allowlisted stage/error events; preserve signed envelopes before journaling; bind recovery to signed current/target manifests plus journal tip; require exact single-use CONTINUE or ROLLBACK with full revalidation; resume cleanup/finalization or use verified rollback according to the exact durable boundary."
- verification: "Managed typecheck and focused synthetic regression tests pass; full fresh unnumbered R1 pending on the final clean corrective commit."
- files_changed: ["packages/installer/src/archive-core.ts", "packages/installer/src/install.ts", "packages/installer/src/journal.ts", "packages/installer/src/recovery.ts", "packages/installer/src/upgrade.ts", "packages/test-support/src/upgrade-fixture.ts", "scripts/install/bootstrap.ps1", "tests/integration/bootstrap.test.ts", "tests/integration/upgrade-recovery.test.ts"]
