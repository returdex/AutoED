---
quick_id: 260902-lse
type: quick
mode: validate
status: complete
files_modified:
  - AGENTS.md
  - .planning/PROJECT.md
  - .planning/ROADMAP.md
  - .planning/RELEASE-STABILIZATION.md
  - .planning/phases/02-poc-live/02-CONTEXT.md
  - .planning/phases/02-poc-live/02-PLAN-OUTLINE.md
  - .planning/phases/02-poc-live/02-14-PLAN.md
  - .planning/phases/02-poc-live/02-38-PLAN.md
  - .planning/phases/02-poc-live/02-39-PLAN.md
  - .planning/phases/02-poc-live/02-13-PLAN.md
  - .planning/forensics/report-20260902-051348.md
must_haves:
  truths:
    - "Beta.31 and the active 02-14 human update checkpoint remain byte- and state-compatible; this task changes no signed product/release tooling, artifact, receipt, tag or remote object."
    - "Every post-beta.31 repair or future milestone release must pass an unnumbered internal rehearsal before an immutable beta.N is assigned."
    - "Source/contract failures, runner/setup failures, transient OS failures and post-publication failures have distinct consequences; only public objects retain unconditional no-reuse/no-overwrite treatment."
    - "The managed runtime, real archive/dependency closure, release state model, volatile receipt fields and bounded CDN readiness are verified before candidate lock."
    - "All later Phase 2 live plans inherit one canonical repair route instead of immediately burning a new beta for every failure."
  artifacts:
    - path: .planning/RELEASE-STABILIZATION.md
      provides: "Canonical post-beta.31 staged release and failure-classification contract"
    - path: AGENTS.md
      provides: "Project-wide enforcement and precedence over older generic repair wording"
    - path: .planning/phases/02-poc-live/02-38-PLAN.md
      provides: "Future corrective-rerun entrypoint with rehearsal before candidate selection"
    - path: .planning/phases/02-poc-live/02-14-PLAN.md
      provides: "Current human gate with revised future repair routing but unchanged beta.31 instructions"
  key_links:
    - from: AGENTS.md
      to: .planning/RELEASE-STABILIZATION.md
      via: "mandatory post-beta.31 release policy reference"
    - from: .planning/ROADMAP.md
      to: .planning/RELEASE-STABILIZATION.md
      via: "cross-phase release guardrail"
    - from: .planning/phases/02-poc-live/02-38-PLAN.md
      to: .planning/RELEASE-STABILIZATION.md
      via: "pre-candidate rehearsal and classified failure loop"
    - from: .planning/phases/02-poc-live/02-14-PLAN.md
      to: .planning/RELEASE-STABILIZATION.md
      via: "repair routing after a genuine human checkpoint failure"
---

# Quick Task 260902-lse: Enforce post-beta.31 release stabilization

## Objective

Apply the forensic recommendations to future AutoED release work without invalidating or modifying the already signed and published beta.31. Establish one canonical staged lifecycle, wire it into authoritative project policy and future corrective plans, and verify that the active 02-14 human update instructions and release handoff remain unchanged.

## Task 1: Define the canonical release-stabilization contract

**Files:** `.planning/RELEASE-STABILIZATION.md`, `AGENTS.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/phases/02-poc-live/02-CONTEXT.md`, `.planning/phases/02-poc-live/02-PLAN-OUTLINE.md`

**Action:** Create a post-beta.31 policy with explicit stages: design/source freeze; unnumbered internal rehearsal; managed-runtime and high-risk environment preflight; real dual-target closure/prompt/release-state rehearsal; immutable candidate assignment only after rehearsal; final exact quality/signing/publication; bounded anonymous readiness; one full verifier; then human gates. Define failure classes and their consequences. Preserve strict public immutability while allowing pre-publication runner/transient failures with zero source/artifact drift to be diagnosed and completely rerun without automatically consuming a public version. Make this policy authoritative over older shorthand such as “修复→新 beta”, while retaining every privacy, identity and human-action gate.

**Verify:** The policy explicitly grandfathers beta.31, prohibits current source/release changes, distinguishes at least four failure classes, requires managed runtime and rehearsal before selection, and is referenced from AGENTS/PROJECT/ROADMAP/Phase 2 context and outline.

**Done:** Future release work has one approved, non-ambiguous lifecycle that prevents premature beta assignment and retains no-overwrite guarantees.

## Task 2: Rewire the Phase 2 repair path without changing the current checkpoint

**Files:** `.planning/phases/02-poc-live/02-14-PLAN.md`, `.planning/phases/02-poc-live/02-38-PLAN.md`, `.planning/phases/02-poc-live/02-39-PLAN.md`, `.planning/phases/02-poc-live/02-13-PLAN.md`

**Action:** Mark beta.31's completed historical chain as unchanged. For any future corrective rerun after beta.31, make 02-38 begin with an unnumbered rehearsal and environment determinism gate before selecting beta.N; require a rehearsal attestation for later 02-39/02-13 execution; route 02-14 failures through the canonical classification policy. Do not alter the exact beta.31 version, hashes, prompt, feedback schema, hard human-action task or current stop condition.

**Verify:** Future corrective wording references the canonical policy; candidate selection is no longer the first action for post-beta.31 repairs; 02-39/02-13 reject missing rehearsal evidence for later candidates; 02-14 still requires the same exact beta.31 user feedback and remains blocking.

**Done:** Later live-gate failures cannot restart the old blind 02-38→39→13 loop without stabilization, while the current user update remains valid.

## Task 3: Verify scope, invariants and audit trail

**Files:** `.planning/forensics/report-20260902-051348.md`, quick-task SUMMARY and VERIFICATION artifacts, `.planning/STATE.md`

**Action:** Verify no files under `apps/`, `packages/`, `scripts/`, `tests/`, `release/`, `.runtime/` or lockfiles changed. Hash the five current beta.31 release handoff files before and after and require equality. Validate that no tag/remote/publication action occurred, `STATE.md` still stops at 02-14, and Windows/live/Phase 3 gaps remain unchanged. Record the forensic report and this policy task in the quick-task audit trail.

**Verify:** `git diff --check`; scoped diff allowlist; before/after SHA-256 equality for beta.31 handoff files; plan structure checks; canonical-reference coverage; current-state assertions.

**Done:** The policy change is planning-only, auditable and proven not to invalidate beta.31 or bypass 02-14.
