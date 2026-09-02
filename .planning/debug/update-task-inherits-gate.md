---
status: resolved
trigger: "The user followed Plan 02-14 by opening a new Codex task and pasting the update request, but that task inherited AutoED AGENTS.md and refused to run the beta.31 update because the current hard-stop wording globally prohibits agents from performing it."
created: 2026-09-02T06:10:20Z
updated: 2026-09-02T06:15:28Z
---

# Debug Session: Update task inherits controller gate

## Symptoms

- Expected behavior: The Phase 2 controller remains stopped while a separately initiated update task runs only the verified beta.31 updater; the user personally handles OS approval and Codex restart, then returns strict sanitized feedback.
- Actual behavior: The new Codex task reads the repository `AGENTS.md`, treats the controller-only prohibition as global, refuses the update and returns `human_needed/not_observed` without running it.
- Error messages: No product error. The task reports that it cannot perform or attest the update because Phase 2 is at the mandatory human-action gate.
- Timeline: First observed on 2026-09-02 during the first attempt to follow Plan 02-14 Task 2 for beta.31.
- Reproduction: Create a new Codex task attached to the AutoED project, paste the beta.31 update request, and observe that the task inherits the repository hard-stop instruction and refuses.

## Current Focus

- hypothesis: Plan 02-14's phrase “在将实际运行 AutoED 的 Codex 中新开更新任务” omitted the required projectless isolation boundary, so the update executor inherited the controller's AGENTS policy and correctly refused; the signed beta.31 prompt itself is not defective.
- test: Compare the inherited AGENTS current-stop wording, Plan 02-14 human steps and immutable external prompt; verify that a projectless local Codex task can be explicitly designated as the update executor without changing the signed prompt or weakening human/credential/live gates.
- expecting: Project/controller tasks remain prohibited from updating, while instructions route the user to a separate local projectless updater task that consumes the byte-exact prompt, never writes planning evidence and returns only sanitized results.
- next_action: User retries the unchanged beta.31 external prompt from a local projectless Codex task on the same macOS host/account and returns the strict sanitized update result to the controller.
- reasoning_checkpoint: Do not run the update, alter beta.31 bytes, log in, approve OS prompts, restart Codex, create an update receipt or advance 02-15 while fixing the orchestration deadlock.
- tdd_checkpoint: Documentation/process regression; verify through structural and invariant checks rather than product tests.

## Evidence

- timestamp: 2026-09-02T06:10:20Z
  observation: `AGENTS.md` globally says the current task must not perform the update, click OS approval, restart Codex, create a pass receipt or advance; every AutoED project task inherits this rule.
- timestamp: 2026-09-02T06:10:20Z
  observation: Plan 02-14 step 2 tells the user only to open a new update task in Codex and does not say projectless or detached from the AutoED project/worktree.
- timestamp: 2026-09-02T06:10:20Z
  observation: The exact beta.31 external install prompt contains immutable target/hash/boundary instructions but no controller-versus-updater task routing; changing it would alter the signed prompt hash and is neither necessary nor allowed.
- timestamp: 2026-09-02T06:10:20Z
  observation: The user's returned refusal contains no installed-state observation and is correctly non-passing feedback; it must not create a receipt or consume another beta.
- timestamp: 2026-09-02T06:15:28Z
  observation: AGENTS, PROJECT D16, ROADMAP, RELEASE-STABILIZATION R6, Phase 2 D-20 and Plan 02-14 now distinguish a non-updating repository controller from a bounded local projectless updater task and classify inherited-gate refusal as UPDATE_TASK_CONTEXT_INVALID.
- timestamp: 2026-09-02T06:15:28Z
  observation: Plan 02-14 passes GSD plan-structure verification with zero errors/warnings; all six beta.31 handoff file SHA-256 values remain exactly unchanged and no release/product/test/runtime file changed.
- timestamp: 2026-09-02T06:15:28Z
  observation: The strict non-pass `MacosUpdateFeedback.result_code` allowlist now includes UPDATE_TASK_CONTEXT_INVALID; the pass-only machine receipt schema remains unchanged and still cannot be created from this result.

## Eliminated

- hypothesis: The beta.31 archive, prompt hash or availability proof is already shown to be invalid.
  reason: The returned text reports a policy refusal before update execution, not a hash, signature, download, installer or runtime failure.
- hypothesis: A new beta is required to correct the workflow.
  reason: The signed install prompt remains exact; the defect is in controller-side task routing and can be corrected without changing release bytes.

## Resolution

- root_cause: Plan 02-14 required a “new Codex update task” but did not specify that it must be local and projectless. A task attached to AutoED therefore inherited the repository controller's mandatory stop and correctly refused, making the documented route impossible.
- fix: Preserve the repository task as the non-updating controller and route the byte-exact verified prompt to a same-host/account local projectless Codex updater task. Bound that updater to managed update directories and sanitized output only; the user still controls OS approval/restart, while school access, planning writes, gate receipts and phase advancement remain prohibited. Classify an inherited controller refusal as UPDATE_TASK_CONTEXT_INVALID and retry the same immutable beta rather than issuing a repair beta.
- verification: GSD plan-structure validation passes for 02-14 with zero errors/warnings; canonical policy references agree; git scope contains planning/debug/AGENTS only; beta.31 selection, test, artifact, publication, availability and prompt hashes are unchanged; no update receipt or 02-14 success summary exists.
- files_changed: AGENTS.md; .planning/PROJECT.md; .planning/ROADMAP.md; .planning/RELEASE-STABILIZATION.md; .planning/phases/02-poc-live/02-CONTEXT.md; .planning/phases/02-poc-live/02-14-PLAN.md; .planning/STATE.md; .planning/debug/update-task-inherits-gate.md
