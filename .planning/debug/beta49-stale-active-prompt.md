---
status: fixing
trigger: "授权在当前 AutoED 本地项目执行 beta.49 R4 失败后的 bounded R0 诊断和必要修复，包括退役遗留 beta.48 install prompt、使 fresh R1 在开始和结束时拒绝所有旧 R2→R5 active pointers，并完成修复提交后的 fresh unnumbered R1；不选择 beta.50、不签名、不发布、不安装、不登录、不推进 02-15/Phase 3。"
created: 2026-09-14T02:20:00+10:00
updated: 2026-09-14T02:20:00+10:00
---

# Debug Session: beta.49 stale active prompt

## Symptoms

- Expected behavior: after beta.48 invalidation, every active R2–R5 pointer is absent before a fresh unnumbered R1 and later R2 selection; R1 must reject stale pointers at both its initial and final snapshots.
- Actual behavior: beta.48 invalidation removed selection, test, artifact, publication and availability receipts but retained the tracked beta.48 `release/phase2-install-prompt.md`; beta.49 passed R2/R3, then its first R4 invocation stopped before build/signing with `PHASE2_ASSEMBLY_OUTPUT_EXISTS`.
- Error messages: `PHASE2_ASSEMBLY_OUTPUT_EXISTS`.
- Timeline: first observed on 2026-09-14 during the first beta.49 R4 invocation.
- Reproduction: with only the stale tracked beta.48 install prompt present in the active release-output set, the unnumbered R1 passes unchanged-state snapshots, beta.49 R2/R3 pass, and `assemble-phase2.mjs` rejects the pre-existing prompt before mutation.
- Safety result: beta.49 is immutable unpublished `POST_SOURCE`; no build, Keychain signing, candidate artifact, tag, release, public asset, availability receipt, installation, login, source access, 02-15 or Phase 3 action occurred.

## Current Focus

reasoning_checkpoint:
  hypothesis: "R1 validates receipt-set stability but not clean-start/clean-end absence, while beta.48 invalidation omitted the prompt from its deletion set; therefore a stable stale pointer is accepted until R4 refuses it."
  confirming_evidence:
    - "The tracked prompt identifies beta.48 and predates beta.49 selection."
    - "R4 checks version root, artifact receipt and prompt path existence before environment preflight, build or signing."
    - "R1 receiptDigest includes the prompt but sameSnapshot accepts the same stale digest at start and finish."
  falsification_test: "The new focused regression must receive ACTIVE_RELEASE_POINTER_INITIAL for each of the six valid initial pointer snapshots, ACTIVE_RELEASE_POINTER_FINAL when a valid pointer appears only after the suites, and a clean snapshot must still pass."
  fix_rationale: "Expose the existing canonical R2–R5 path enumeration as an ordered snapshot field, reject a nonempty validated list at both boundaries, and delete only the stale canonical beta.48 prompt. This prevents the mechanism that caused R4 to fail while retaining historical invalidation and rehearsal records."
  blind_spots: "The invariant must not classify historical invalidation documents or unnumbered rehearsal attestations as active pointers; only the six canonical release paths are in scope."
next_action: "Confirm only the stale beta.48 install prompt was retired and every other canonical R2–R5 pointer is absent; commit the correction and this session state, then run exactly one complete clean unnumbered R1 on that commit."

## Evidence

- timestamp: 2026-09-14T02:20:00+10:00
  observation: beta.49 R2 selection digest `3a7ae96f…` and complete R3 test-report digest `d6d3a7ac…` passed before the first R4 invocation.
- timestamp: 2026-09-14T02:20:00+10:00
  observation: the first R4 invocation returned `PHASE2_ASSEMBLY_OUTPUT_EXISTS` before any beta.49 build, signing or artifact directory existed.
- timestamp: 2026-09-14T02:20:00+10:00
  observation: the sole conflicting canonical output is the tracked beta.48 install prompt; beta.49 tag/release/artifact/publication/availability objects are absent.
- timestamp: 2026-09-14T02:36:00+10:00
  observation: "scripts/release/phase2-rehearsal.mjs defines six canonical active R2–R5 paths: build selection (R2), test report (R3), artifacts and install prompt (R4), publication and availability (R5). The production snapshot hashes their current bytes but reports only one receiptsSha256 digest."
- timestamp: 2026-09-14T02:36:00+10:00
  observation: "runPhase2Rehearsal accepts an initial snapshot after snapshotValid(), and accepts the final state if sameSnapshot() holds. Neither function can distinguish an empty receipt set from a stable stale receipt set; the existing fixed-rehearsal test supplies the same snapshot at both stages."
- timestamp: 2026-09-14T02:41:00+10:00
  observation: "The new focused integration regression fails on unmodified production code: a snapshot carrying an active pointer is rejected only as PRE_RUNNER/IDENTITY_INVALID because the schema has no pointer field, rather than the required PRE_SOURCE/ACTIVE_RELEASE_POINTER_INITIAL. This directly demonstrates the missing observable invariant."
- timestamp: 2026-09-14T02:44:00+10:00
  observation: "After the targeted snapshot-schema change, the managed focused release-gates integration file passes 48/48, including each of the six initial-pointer cases and the final prompt-introduction case. Managed typecheck also passes."

## Eliminated

- hypothesis: beta.49 signing key, signature, archive closure or GitHub publication failed.
  reason: R4 rejected output existence before environment preflight, build, signing or remote mutation.
- hypothesis: the conflict is a one-off filesystem transient.
  reason: the prompt is a deterministic tracked file retained by the beta.48 invalidation commit.

## Resolution

- root_cause: "The beta.48 invalidation omitted the tracked canonical R4 install prompt, and R1's receiptDigest/sameSnapshot contract reduced the six active R2–R5 paths to a single equality-only hash. A stable nonempty active release-output set therefore passed R1 until R4 correctly refused its pre-existing prompt."
- fix: "Deleted only release/phase2-install-prompt.md (the stale beta.48 canonical R4 pointer). R1 snapshots now carry a strictly ordered subset of the six canonical R2–R5 paths and fail PRE_SOURCE with ACTIVE_RELEASE_POINTER_INITIAL or ACTIVE_RELEASE_POINTER_FINAL when nonempty."
- verification: pending
- files_changed:
  - release/phase2-install-prompt.md
  - scripts/release/phase2-rehearsal.mjs
  - tests/integration/phase2-release-gates.test.ts
