# Release Stabilization Policy

**Approved:** 2026-09-02
**Applies to:** every AutoED release candidate selected after `0.1.0-beta.31`, including repairs discovered during Phase 2 live gates and all later milestones
**Does not change:** the published beta.31 bytes or public objects, public history, privacy rules, platform gates or no-overwrite requirements

## Purpose and precedence

This policy prevents an internal test, runner or external-readiness attempt from consuming a public prerelease number before the release path is stable. It is authoritative project policy for future candidate creation. Older plan shorthand such as `修复→完整测试→新 beta` means “enter this staged policy”; it does not authorize immediately assigning the next `beta.N`.

Public release immutability remains strict. No policy here permits overwriting, deleting, resigning, relabelling or retrying a published failed identity. Human update/login/MFA/live gates also remain hard stops.

## Lifecycle

### R0 — Decide and freeze the release contract

Before any prerelease number is selected:

- resolve open architecture, prompt, receipt, version-set, platform and external-service semantics;
- identify every source/test/tool file that must change;
- update the relevant PLAN and obtain approval if the repair introduces a new decision or expands scope;
- keep `auto_advance` and `_auto_chain_active` disabled;
- do not sign, tag, publish, update an installation, open school sources or create live evidence.

R0 is incomplete while a downstream output-only plan is still expected to discover or edit release source.

### R1 — Unnumbered internal rehearsal

Use an internal rehearsal identity derived from the exact source commit/tree/build, never an `x.y.z-beta.N` tag or public release coordinate. Rehearsal failures do not consume a prerelease number.

The rehearsal must prove, in this order:

1. the repository-approved managed runtime and dependency pins are active; raw host `npm`, Node or browser binaries cannot silently substitute;
2. worktree/source/build identity is clean and fixed for the attempt;
3. typecheck, complete unit/integration/UI/native suites, zero skip/todo/only and all sensitive scans pass;
4. historically unstable fixed-port, process-observation, upgrade/recovery and cleanup groups pass a focused determinism preflight before the complete suite;
5. both real target dependency trees and archive member closures assemble in a non-public rehearsal area, including legitimate dependency names, symlinks, license/support data and sensitive-path negatives;
6. signed-core/external-prompt construction is free of self-reference and its complete schema can be verified without using `latest` or guessed coordinates;
7. publisher/availability contract tests cover exact repository identity, GitHub absent-tag responses, public-versus-consumed histories, redirects, volatile receipt fields, bounded CDN readiness and exactly one full verifier invocation;
8. no remote mutation, canonical release receipt, public tag or release asset is created.

Write one sanitized rehearsal attestation under `.planning/release-rehearsals/` containing only source/tree/build hashes, managed-runtime identity, bounded counts, command hashes, failure-class history and pass/fail status. It must contain no raw logs, local paths, credentials, Profile data, runtime DB or live evidence.

### R2 — Candidate assignment

Only after R1 passes:

- observe local tags, direct remote tags, public releases and the immutable consumed-version ledger;
- select the next unused `beta.N` once;
- bind the rehearsal-attestation digest, exact source commit/tree/build and version-set digest into the selection;
- make no source or test change after selection.

The prerelease number is a release candidate, not an internal CI attempt counter.

### R3 — Exact candidate qualification

Run the complete managed-runtime quality/security gate again on the selected identity and create the canonical test report only after every command passes. R1 evidence cannot substitute for R3; it reduces avoidable failures before version lock.

### R4 — Assembly and signing

Assemble both targets only from the selected identity and qualified report. Verify actual dependency closure, signed members, prompt core, license/support matrix and sensitive scans before accepting an artifact receipt. No historical archive or prompt may be renamed or reused.

### R5 — Publication readiness and one-shot verification

Before public mutation, repeat repository/identity/tag/asset conflict checks. Publish once without overwrite, force or delete. After upload:

- run a bounded anonymous metadata/HEAD readiness gate for exact repository, tag, target, asset IDs, redirects and content lengths;
- readiness makes no full-byte/signature/pass claim and writes no availability receipt;
- only after readiness passes, invoke the clean anonymous full-byte/hash/signature/closure verifier exactly once;
- a failed full verifier permanently consumes that published identity; do not retry or rewrite it.

### R6 — Human update and live gates

Only an availability-proven release may be shown to the user. Publication, readiness, download or automated native evidence never substitutes for the user's actual update, OS approval, official login/MFA or live result.

The repository Phase executor remains a non-updating controller. The user runs the verified external prompt in a separate **local projectless Codex updater task** on the same host/account; that task may perform only the prompt's bounded automated update and return sanitized output, while the user personally controls OS approval and restart. A task attached to the AutoED project/worktree will inherit the controller gate and must refuse; classify that refusal as `UPDATE_TASK_CONTEXT_INVALID`, correct the task context and reuse the same immutable candidate. It is not a product failure and does not authorize a later beta.

## Failure classification

| Class | Example | Required response | Consumes beta.N? |
|---|---|---|---|
| `PRE_SOURCE` | source, contract, test or prompt defect found in R0/R1 | fix inside rehearsal; rerun affected focused checks and complete R1 | No beta has been assigned |
| `PRE_RUNNER` | wrong Node, occupied test port, invalid temp permissions, harness setup | correct the runner; prove managed environment; rerun complete R1 | No beta has been assigned |
| `POST_SOURCE` | any source/test/tool or artifact-byte change after R2 | invalidate the selected candidate; return to R0/R1 before selecting another | Yes |
| `POST_TRANSIENT` | no-source-drift OS/process/network failure before publication | record safe diagnostics; focused reproduction; require two consecutive clean complete candidate gates; ambiguity or recurrence becomes invalidation | Not automatically, only when no public object/artifact drift exists |
| `POST_ARTIFACT` | canonical signed artifact mismatch or failed local verification | preserve diagnostics; invalidate and return to R0/R1 | Yes |
| `POST_PUBLIC` | tag/release exists but readiness or the one full verifier fails | preserve public history, never retry/overwrite/delete; repair through R0/R1 and select a later beta | Yes, permanently |
| `HUMAN_ENV` | user declines OS approval, device unavailable, result not observed | keep the human checkpoint blocked; do not infer a product defect or issue a beta | No |
| `HUMAN_PRODUCT` | actual installed beta exposes a reproducible product/source defect | record only sanitized result; return to R0/R1; select a later beta only after rehearsal passes | Existing published beta remains immutable and invalidated for that gate |

`POST_TRANSIENT` retention is allowed only when all of these are proven: no tag/release exists, no source/test/tool/artifact bytes changed, the failed output is sanitized and retained, focused diagnosis identifies an environment/transient cause, and two fresh complete gates pass consecutively. Otherwise invalidate.

## Plan enforcement

- For future corrective runs after beta.31, Plan 02-38 begins at R0/R1, not candidate selection. Its first corrective execution must implement and test the strict rehearsal-attestation writer plus conditional selection validator before any later beta is assigned; beta.31 remains the only schema-v1 grandfathered input.
- Plan 02-39 and Plan 02-13 must reject a post-beta.31 candidate whose selection lacks the rehearsal-attestation digest.
- A live plan that discovers a missing capability must stop; it may not patch in place. It routes to this policy and does not immediately reserve a new beta number.
- Future milestone planning must include R0–R6 as explicit dependencies whenever it creates a public release.
- Plan checkers and verifiers must flag any claim that later output-only plans will edit release source, any direct use of host runtime, or any repair wording that skips rehearsal.

## Beta.31 historical exception and failure

Beta.31 completed its then-current managed-runtime quality, assembly, signing, bounded readiness, publication and anonymous verification chain before this policy was written, so its historical receipts do not require a retroactive rehearsal attestation. The real 02-14 macOS update later failed with `ENTRYPOINT_MISMATCH`, proving that the old availability contract covered the outer capability archives but not a runnable updater graph. Beta.31 is immutable published history and invalidated for the update gate. Every repair candidate must follow R0–R6 without inheriting this exception.

## Beta.37 public availability failure

Beta.37 completed the post-beta.31 R0–R4 stabilization gates and was published once with its immutable tag, release and 16 assets. The bounded anonymous metadata/HEAD readiness gate reached the one permitted full verifier, which failed with `PHASE2_AVAILABILITY_FAILED` and produced no availability receipt. This is `POST_PUBLIC`: the public identity is permanently consumed and must not be retried, overwritten, deleted or shown as an update candidate. Read-only release metadata matched the local publication receipt's identity, asset sizes and server-reported SHA-256 digests, but the verifier exposed no narrower non-sensitive cause. Future repair returns to R0/R1 before selecting a later beta; human update, source configuration/login, Windows native evidence and Phase 3 remain blocked.

## Beta.38 public target-proof failure

Beta.38 completed the post-beta.31 R0–R4 stabilization gates and was published once with its immutable tag, release and 16 assets. The bounded anonymous metadata/HEAD readiness gate passed, but the one permitted clean full verifier failed with `PHASE2_AVAILABILITY_FAILED` at the allowlisted diagnostic tuple `phase=target-proof`, `asset=macos`, `reason=archive_or_signature`; no availability receipt was written. This is `POST_PUBLIC`: beta.38 is permanently consumed and must not be retried, overwritten, deleted, relabeled or shown as an update candidate. The publication receipt and public objects remain immutable history. Future repair returns to a fresh unnumbered R0/R1 before selecting beta.39; human update, source configuration/login, Windows native evidence and Phase 3 remain blocked.

## Beta.39 unavailable verifier result

Beta.39 completed the post-beta.31 R0–R4 stabilization gates and was published once with its immutable tag, release and 16 assets. Its one permitted anonymous full verifier was invoked, but the controller wait was interrupted before a sanitized verifier result or availability receipt was produced. Availability cannot be attested from that attempt. This is `POST_PUBLIC`: beta.39 is permanently consumed and must not be retried, overwritten, deleted, relabeled or shown as an update candidate. The publication receipt and public objects remain immutable history. Future repair returns to a fresh unnumbered R0/R1 before selecting beta.40; human update, source configuration/login, Windows native evidence and Phase 3 remain blocked.
