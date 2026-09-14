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

## Beta.40 archived-closure digest failure

Beta.40 completed R2–R4 and was published once with 16 immutable assets. Its bounded readiness gate reached the one permitted anonymous full verifier, which failed with `PHASE2_AVAILABILITY_FAILED phase=target-proof asset=macos reason=archive_or_signature`; no availability receipt was written. Local read-only diagnosis reproduced the same first failure for both target archives: the temporary R4 script wrote ordinary JSON closure bytes but bound the canonical-object digest, while R5 correctly required the digest of the exact archived bytes. This is `POST_PUBLIC`: beta.40 is permanently consumed and must not be retried, overwritten, deleted, relabeled or shown as an update candidate. The correction must complete a fresh unnumbered R0/R1 before any later candidate selection; human update, source login, Windows native evidence, 02-15 and Phase 3 remain blocked.

## Beta.44 macOS installation-identity failure

Beta.44 completed R0–R5 and remains an immutable availability-proven public release, but its first real projectless macOS update stopped before activation with `INVALID_INSTALLATION`. Sanitized local diagnosis proved that schema-1 installation identity required exact `st_dev`, inode and UID equality even though macOS changed the mount-instance device value after a later boot; inode, UID, protected-root structure, installation/active/launcher bindings, the beta.19 release signature and complete program/Node/browser closures still matched. No beta.44 program was activated, beta.19 remained unchanged, no process remained, no school source was accessed and no success receipt exists. This is `HUMAN_PRODUCT`: beta.44 is permanently invalidated for the update gate and must not be retried, overwritten, deleted, relabeled or manually repaired. The approved correction must complete R0/R1 with a fail-closed signed schema migration before any later candidate may be separately authorized; Windows/live evidence remain `not_run/human_needed`, and 02-15/Phase 3 remain blocked.

## Beta.45 client PID-reuse recovery failure

Beta.45 completed R0–R5 and remains an immutable availability-proven public release, but its real macOS updater stopped before recovery preview with `INSTALLATION_RECOVERY_UNCONFIRMED`. The updater task itself violated the projectless/one-shot/no-workspace-write boundary, yet the signed installer actually ran against the real managed root, so this is not a context-only refusal and beta.45 cannot be retried. Sanitized read-only stage diagnosis proved that all 214 client leases were structurally bound to the installation, 212 PIDs were absent, two had been reused by unrelated processes, and zero exact owned clients were running. The recovery check rejected PID occupancy without comparing OS start identity and executable. No activation, beta.19 mutation, remaining AutoED process, school/Profile access, cleanup/readiness or live receipt exists. This is `HUMAN_PRODUCT`: preserve beta.45 permanently and retire active pointers. Corrective R0 must distinguish PID reuse, bind and revalidate the full recovery scope after confirmation, expose only allowlisted stage codes, and embed projectless/one-shot/no-workspace-write rules in the signed prompt. A fresh complete R1 and separate authorization are required before beta.46 selection; Windows/live remain `not_run/human_needed`, and 02-15/Phase 3 remain blocked.

## Beta.46 ambiguous R3 failure

Beta.46 was selected exactly once from the fresh post-beta.45 R1 identity, then its first formal R3 candidate gate stopped in the per-file integration suite with `PRE_SOURCE / COMMAND_PROCESS_FAILED_INTEGRATION_TWO_BUILD_UPGRADE`. An immediate independent run of the exact file passed 9/9 in about 225 seconds, and no source/test/tool/artifact/remote drift or owned residual process was found. The bounded failed run did not retain an allowlisted assertion or environmental cause, so the evidence cannot satisfy the policy's requirement for a positively identified single transient. Ambiguity therefore permanently consumes and invalidates beta.46 before signing or publication. No beta.46 tag, release, public/signed asset, test/artifact/publication/availability receipt, installation, login or live action exists. Active selection is retired; return to R0 for bounded diagnosis and then a complete fresh unnumbered R1 before any beta.47 authorization or selection. Windows/live remain `not_run/human_needed`, and 02-15/Phase 3 remain blocked.

## Beta.47 CLI chain timeout and cleanup cascade

Beta.47 was selected exactly once from the fresh post-beta.46 corrective R1 identity, then its first formal R3 stopped in the fixed per-file integration chain at client-wiring. Bounded reproduction located the primary failure at the preceding CLI lifecycle test: a 60-second whole-test timeout expired while asynchronous fixture work continued, followed by a secondary `INVALID_INSTALLATION` during later fixture provisioning/cleanup. The synthetic CLI adapter had a contradictory 15-second timeout for lifecycle commands that can sequentially wait on two owned services, and it rejected after `SIGTERM` without first proving that the exact child closed. Correcting those source/test/release-tool boundaries makes beta.47 immutable unpublished `POST_SOURCE` history. No tag, release, signed/public asset, canonical R3 or later receipt, installation, login or live action exists. The correction gives lifecycle operations honest bounded budgets, requires TERM/KILL/close-confirmed exact-child cleanup, expands only the containing workflow budgets, and classifies `CLI_OUTPUT_TIMEOUT` explicitly. A forced timeout regression and the fixed complete integration chain pass with no residual owned process. A complete fresh unnumbered R1 and separate authorization are required before any beta.48 selection; 02-15/Phase 3 remain blocked.

## Beta.48 noninteractive confirmation-transport failure

Beta.48 completed R2–R5, was published once with 16 immutable assets, and its one
permitted anonymous full verifier produced a valid availability receipt. Its single
real macOS projectless updater passed immutable-coordinate verification and all
bounded legacy-recovery checks, then emitted the recovery preview. The external
prompt nevertheless allowed a noninteractive bootstrap with closed standard input.
Because the signed installer needs `RECOVER <scopeHash>` and then `INSTALL
<scopeHash>` from the same invocation, it stopped before recovery migration,
install preview or activation.

This is `HUMAN_PRODUCT`: beta.48 is permanently invalidated for the update gate
and its tag, release, assets and availability history are immutable. Do not retry,
overwrite, delete, relabel, resign, republish or use it as an active candidate.
beta.19 remained staged; beta.48 was not activated; no AutoED process remained;
no school source, login, Profile access, course change, 02-15 or Phase 3 action
occurred. Corrective R0 rejects non-TTY transport before mutation and binds future
signed-core and external prompts to one live PTY/session that surfaces every
preview, pauses for genuine exact input and relays it to the same still-running
process. Retire active selection, test, artifact, publication, availability and
prompt pointers. A fresh complete unnumbered R1 passed on `78db757…` /
`bc08b986…` with build `5ad0e07a…`, focused 35, quality 1/154/401/34/24,
dual 8-asset closures, zero sensitive findings and zero remote mutations.
Separate authorization remains required before any later candidate selection.

## Beta.49 stale active-prompt collision

Beta.49 was selected once from the passing post-beta.48 R1 identity and its
complete R3 gate passed 1/154/401/34/24 with zero disabled tests and zero
sensitive findings. Its first formal R4 invocation then stopped before build,
signing or artifact creation with `PHASE2_ASSEMBLY_OUTPUT_EXISTS`. The retained
object was the tracked beta.48 install prompt: the beta.48 invalidation retired
the other active receipts but omitted this pointer, while R1 only proved that
the stale receipt set did not change. This is deterministic release-state and
rehearsal-contract drift, not `POST_TRANSIENT`. beta.49 is immutable unpublished
`POST_SOURCE` history and must never be retried, signed, tagged, published or
relabelled. Corrective R0 must retire the stale prompt and make R1 reject every
pre-existing active R2–R5 pointer before a fresh complete rehearsal. No later
candidate may be selected without separate authorization; installation, login,
02-15 and Phase 3 remain blocked.

The corrective source now retires only the stale prompt and records the exact
ordered active-pointer subset in both R1 snapshots. Focused release gates pass
48/48, and one complete fresh unnumbered R1 passed on `accc799…` / `e6e3e243…`
with build `423e5c1a…`, quality 1/154/402/34/24, dual eight-asset closures,
zero sensitive findings and zero remote mutations. The canonical R2 rehearsal
binding digest is `2f2dca83…`. `active update candidate: none`; beta.50 requires
separate authorization.

## Beta.50 ambiguous process-observation and managed-cleanup failure

Beta.50 was selected once from the passing post-beta.49 corrective R1 identity.
Its first formal R3 passed managed typecheck 1/1 and unit 154/154, then stopped
in the per-file integration chain at `managed-cleanup` with
`PRE_RUNNER / PROCESS_GROUP_OBSERVATION_FAILED`. Bounded diagnosis found no
source/test/tool/artifact/remote drift or residual owned process. The first
independent exact-file run instead exited nonzero after a normally observed
closed group; a second exact-file run passed 7/7 with zero skip/todo. These
different outcomes do not identify the one environmental transient required by
the `POST_TRANSIENT` retention exception. Ambiguity therefore permanently
consumes beta.50 before canonical R3 reporting, signing or publication. Active
selection is retired; return to bounded R0 and then a complete fresh unnumbered
R1 before beta.51 may be separately authorized or selected. Installation,
login, Windows/live evidence, 02-15 and Phase 3 remain blocked.

## Post-beta.50 persistent-session R1 pass

The beta.50 invalidation is permanent and unchanged. Its bounded runner repair
then completed a clean persistent-session unnumbered R1 on commit `1d5c421e…`,
tree `328ca8a3…`, and build `4f735fbb…`: focused 35; quality
1/154/407/34/24; dual eight-asset closures; zero sensitive findings; zero
remote mutations; and no residual release-runner or synthetic process. This
receipt is automated rehearsal evidence only. `active update candidate: none`;
beta.51 is unselected and requires separate authorization. Do not select a
candidate, begin R2+, sign, publish, install, log in, or advance live work from
this record.

## Beta.51 availability-proven R2–R5 completion

After the controller-only documentation commits changed the checkout identity,
a second complete fresh unnumbered R1 passed on commit `9ed6074…`, tree
`78515099…` and build `9a39bccc…`: focused 35; quality 1/154/407/34/24;
dual eight-asset closures; zero sensitive findings; zero remote mutations; and
no residual owned process. beta.51 was then selected exactly once with selection
SHA-256 `a08a6a8c…`. Its complete R3 passed 1/154/407/34/24 with zero
skip/todo and zero sensitive findings; test-report SHA-256 is `5d34ff2a…`.

R4 rebuilt the exact selected version, produced and Ed25519-signed 16 assets,
proved both complete target archives locally and passed the final read-only
preflight. R5 published `v0.1.0-beta.51` once, then its single permitted
anonymous full verifier downloaded all 16 assets and verified the byte counts,
SHA-256 values, signatures, canonical capability closure, signed prompt core
and updater graph. A valid availability receipt exists. `active update
candidate: 0.1.0-beta.51 (availability-proven, human update not run)`.

No installation, OS confirmation, login, school/Profile access, live evidence,
02-15 or Phase 3 action occurred or is authorized. The repository task remains
the non-updating controller. Any later real update requires separate permission
and must use the exact tracked install prompt in a same-host/account local
projectless Codex task with one live PTY and one bootstrap invocation across
both genuine human confirmation gates.

## Beta.51 aggregate interactive deadline failure

Beta.51 completed R2–R5 and its single anonymous full verifier, then its one
real macOS projectless update completed the legacy identity migration and
accepted the exact INSTALL scope. The published bootstrap subsequently exited
1 with `ETIMEDOUT` and `SIGTERM`, without completion, readiness or cleanup
evidence. Read-only decoding of the exact published bootstrap proves that its
verified core invoked the interactive installer with `execFileSync(...,
timeout:300000)`. That deadline covered both human gates and the whole upgrade,
so the bootstrap—not an inner bounded install operation—sent SIGTERM at five
minutes. A bounded process-only observation found two beta.51 target API/Worker
processes, proving the product transition reached at least `started`; it does
not prove feature verification, cleanup, reopen or completion.

This is `HUMAN_PRODUCT`. beta.51 and all public bytes remain immutable and must
not be rerun, overwritten, deleted, relabelled or promoted. Active R2–R5
pointers are retired. Corrective R0 removes the aggregate deadline from the
interactive child on macOS and Windows while retaining bounded OS-version,
network and product-stage operations. The installer now emits allowlisted stage
intent/done events and a structured allowlisted error. An abandoned journal is
classified read-only against the signed current and target manifests plus its
hash-chain tip, exposed without paths or arbitrary error text, and requires an
exact `CONTINUE <scopeHash>` or `ROLLBACK <scopeHash>` response. The whole proof
is repeated before adopting the lock or changing maintenance/database/launcher
state. Exact cleanup/finalization states continue idempotently; activated but
not cleaned states use the verified rollback engine; exact pre-mutation states
retire only the stale lock and retain data.

No actual managed-root or Profile read/write, beta.51 rerun, beta.52 selection,
signing, publication, installation, login, 02-15 or Phase 3 action is authorized
by this correction. A complete fresh unnumbered R1 on the final corrective
commit is mandatory before beta.52 may be separately authorized.
