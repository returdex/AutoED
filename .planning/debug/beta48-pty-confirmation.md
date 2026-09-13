---
status: verifying
trigger: "授权在当前 AutoED 本地项目执行 beta.48 human-update 失败后的 bounded R0 诊断和必要修复，包括保证 bootstrap 单一 PTY 进程跨恢复/安装两个人工确认门持续运行，并完成修复提交后的 fresh unnumbered R1；不选择 beta.49、不签名、不发布、不安装、不登录、不推进 02-15/Phase 3。"
created: 2026-09-13T23:50:09+10:00
updated: 2026-09-14T00:38:00+10:00
---

# Debug Session: beta.48 PTY confirmation handoff

## Symptoms

- Expected behavior: The exact beta.48 bootstrap runs once in a same-host/account local projectless task, remains attached to one interactive process, pauses at the signed recovery preview for the user's exact `RECOVER <scopeHash>` confirmation, then pauses at the install preview for the user's exact `INSTALL <scopeHash>` confirmation.
- Actual behavior: The projectless task invoked the verified bootstrap through a non-interactive shell. The installer passed all recovery-scope checks and emitted `installation_identity_recovery_preview`, but stdin was closed while it awaited the exact recovery confirmation, so the same invocation exited nonzero and the update stopped before migration or install preview.
- Error messages: The task summarized `MOUNT_IDENTITY_CHANGED`; the command output showed a valid recovery preview followed by `INSTALLATION_FAILED` after the confirmation prompt could not receive input.
- Timeline: First observed during the single permitted real macOS arm64 update attempt for availability-proven `0.1.0-beta.48` on 2026-09-13.
- Reproduction: Run the exact beta.48 macOS bootstrap in a non-interactive projectless task shell against the existing staged beta.19 schema-1 installation whose volatile mount device changed.
- Safety result: beta.19 remains unchanged and staged; beta.48 was not activated; the bootstrap was not retried; cleanup completed; no AutoED process remains; no school source, login, Profile read/copy/backup, course deletion, 02-15 or Phase 3 action occurred.

## Current Focus

reasoning_checkpoint:
  hypothesis: "The beta.48 external prompt allowed a non-interactive bootstrap invocation; `renderBootstrapPayload` transfers that closed stdin to `runInstallerCLI`, which requires `RECOVER <scopeHash>` and then `INSTALL <scopeHash>` from that same invocation, so the valid recovery preview cannot advance."
  confirming_evidence:
    - "The real beta.48 run emitted `installation_identity_recovery_preview` only after all eight recovery checks passed, then failed while awaiting recovery input; beta.19 remained staged."
    - "`packages/installer/src/archive-core.ts` launches the verified installer with `stdio: 'inherit'`; `packages/installer/src/install.ts` sequentially awaits RECOVER and INSTALL on `process.stdin`."
    - "`scripts/release/preflight.mjs` renders only an exact-once bootstrap command; its required boundaries do not require a PTY, persistent process/session handle, preview relay, or same-session reply forwarding."
  falsification_test: "A synthetic non-TTY bootstrap/installer invocation must fail before recovery or installation mutation, while a synthetic interactive session that forwards RECOVER and INSTALL through one live stdin stream must emit recovery preview, recovered, install preview, and complete in order."
  fix_rationale: "Reject non-interactive invocation before any installer state change and bind the signed/external prompt to one persistent PTY session that pauses for, then relays, each exact user confirmation to the same still-running process."
  blind_spots: "Synthetic tests cannot prove Codex UI preserves a PTY; the future human gate must verify that behavior. They can prove the updater now rejects the failed transport mode and that the prompt cannot omit the required relay contract."
next_action: "Run exactly `node scripts/dev/runtime.mjs node scripts/release/phase2-rehearsal.mjs --run` from clean commit 5c1a46a; preserve its one sanitized unnumbered attestation only if every fixed R1 gate completes."

## Evidence

- timestamp: 2026-09-13T23:50:09+10:00
  observation: The dedicated child task ran from `/Users/yifeng/Documents/Codex/2026-09-13/autoed-phase2-install`, confirming a local projectless context on Darwin arm64.
- timestamp: 2026-09-13T23:50:09+10:00
  observation: The beta.48 bootstrap SHA-256 passed and the signed installer emitted a recovery preview with reason `MOUNT_IDENTITY_CHANGED`, current version beta.19, processes exited and all eight recovery checks listed before exiting nonzero.
- timestamp: 2026-09-13T23:50:09+10:00
  observation: Source inspection shows `runInstallerCLI` writes the recovery preview and immediately awaits exact `RECOVER <scopeHash>` input on the same stdin before it can migrate identity and produce the ordinary install preview.
- timestamp: 2026-09-13T23:58:00+10:00
  observation: `renderBootstrapPayload` calls the installer using `execFileSync(..., { stdio: 'inherit' })`; therefore the bootstrap has no independent confirmation channel or second process boundary.
- timestamp: 2026-09-13T23:58:00+10:00
  observation: The beta.48 external prompt's only execution invariant is exact-once invocation. It neither requires a TTY nor says to retain one process/session, surface each preview, await genuine user input, and write that input to the same process.
- timestamp: 2026-09-14T00:09:00+10:00
  observation: The corrective source rejects non-TTY stdin/stdout/stderr before manifest processing, and the two rendered prompt layers bind a one-live-session, preview-pause, exact-reply relay rule for both gates.
- timestamp: 2026-09-14T00:24:00+10:00
  observation: Managed typecheck passed. Focused synthetic regressions passed: installation ownership/recovery 4/4, install preview 4/4, and Phase 2 release gates 47/47; `git diff --check` passed.
- timestamp: 2026-09-14T00:24:00+10:00
  observation: An earlier overlapping Vitest owner was identified as this task's exact process group and scoped-terminated. The corrected focused runs left no synthetic services or owned process groups; no rehearsal has started or been claimed.
- timestamp: 2026-09-14T00:38:00+10:00
  observation: Corrective source/test commit `ea2cc60` and beta.48 status/invalidation/pointer-retirement commit `5c1a46a` are complete. The worktree is clean; active selection, test, artifact, publication and availability pointers are absent. The fixed R1 command is local-only and its source reads no release coordinate or external update path.

## Eliminated

- hypothesis: beta.48 download, hash, Ed25519 signature, trust fingerprint, capability closure, license, build identity or public availability failed.
  reason: R2-R5 and the projectless task's immutable-coordinate verification passed before bootstrap execution.
- hypothesis: The legacy receipt failed one of the recovery authorization checks.
  reason: A recovery preview is created only after permissions, identity, launchers, prior release signature, complete file closures, processes, clients and installer credential checks all pass.
- hypothesis: beta.48 partially activated or changed the real installation.
  reason: The process stopped before recovery confirmation and install preview; beta.19 stayed staged and cleanup/process checks completed.

## Resolution

- root_cause: "The signed beta.48 external prompt permitted a non-interactive bootstrap. The bootstrap inherited closed standard input into an installer that requires two sequential exact confirmations from one invocation, so it stopped after the valid recovery preview before any recovery or installation mutation."
- fix: "Require an interactive stdin/stdout/stderr transport before installer processing; bind both signed-core and external prompt rendering to one live PTY/session that surfaces each preview, waits for a real exact confirmation, and relays it to the same still-running process; preserve those requirements with synthetic transport and prompt regressions."
- verification: "Managed typecheck and focused synthetic integration suites pass; the exact clean-source unnumbered R1 is the next required verification and has not started."
- files_changed:
  - packages/installer/src/install.ts
  - packages/test-support/src/upgrade-fixture.ts
  - scripts/release/phase2-gate.mjs
  - scripts/release/preflight.mjs
  - tests/integration/install-preview.test.ts
  - tests/integration/installation-ownership-recovery.test.ts
  - tests/integration/phase2-release-gates.test.ts
