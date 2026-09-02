---
status: fixing
trigger: "The real macOS beta.31 projectless update task returned result=failed, result_code=ENTRYPOINT_MISMATCH, actual_build=mismatch and entrypoints=mismatch while API and Worker remained healthy."
created: 2026-09-02T07:02:03Z
updated: 2026-09-02T07:29:00Z
---

# Debug Session: beta.31 entrypoint mismatch

## Symptoms

- Expected behavior: The exact availability-proven beta.31 updater completes the managed macOS update, reloads the active entrypoints, reports the beta.31 build, preserves data, reaches cleanup=complete and leaves API/Worker/paired UI ready without opening Moodle or EdStem.
- Actual behavior: The dedicated projectless task returned a real failed result. The reported installed build and entrypoints do not match beta.31; API and Worker are healthy, but cleanup and paired UI were not observed.
- Error messages: `ENTRYPOINT_MISMATCH`; no sensitive or free-form diagnostic text was supplied.
- Timeline: Observed at 2026-09-02T16:41:49+10:00 during the first actual beta.31 macOS update attempt after correcting the projectless-task routing.
- Reproduction: Run the exact beta.31 macOS external prompt from a same-host/account local projectless Codex task and inspect its strict sanitized post-update result.

## Sanitized Human Feedback

```text
02-14_UPDATE_RESULT
checkpoint=02-14-macos-update
platform=macos
version=0.1.0-beta.31
artifact_sha256=ef69ead91073aec94e1a7312ae69bb4a4f81f64a484b1ad4919e2b7369b715f1
result=failed
result_code=ENTRYPOINT_MISMATCH
cleanup=not_observed
actual_build=mismatch
entrypoints=mismatch
api=healthy
worker=healthy
paired_ui=not_observed
source_configuration=moodle:not_confirmed,edstem:not_confirmed
school_access=not_started
windows=not_run/human_needed
phase3=blocked
observed_at=2026-09-02T16:41:49+10:00
```

## Current Focus

- hypothesis: Confirmed. The beta.31 release proves an outer capability archive but does not bind or publish a runnable updater bootstrap, standard signed installer manifest, or installer component assets. Its embedded bootstrap is the intentionally inert source template, so a projectless updater cannot perform the promised managed transition.
- test: Require every future Phase 2 external prompt to contain one exact hash-verified executable bootstrap command per native target, with the referenced rendered bootstrap and complete installer assets bound by the release receipt and publication verifier.
- expecting: Current beta.31-shaped receipt/prompt fixture fails because it contains archive coordinates only; the repaired contract passes only when download, bootstrap, signed installer manifest and program/node/browser assets form one closed graph.
- next_action: Commit the failing regression, then extend the Phase 2 artifact/prompt/publication/availability contracts by reusing the existing signed installer pipeline and run an unnumbered old-build-to-new-build rehearsal before selecting another beta.
- reasoning_checkpoint: 02-14 remains failed and blocking. Do not create a pass receipt, run Task 3, advance 02-15, log in, access sources, overwrite beta.31 or assign a later beta before R0/R1 stabilization passes.
- tdd_checkpoint: Not started.

## Evidence

- timestamp: 2026-09-02T07:02:03Z
  observation: The feedback is a genuine non-pass human update result with exact beta.31 version and macOS artifact hash; `ENTRYPOINT_MISMATCH`, build mismatch and entrypoint mismatch satisfy the Plan 02-14 hard-block condition.
- timestamp: 2026-09-02T07:02:03Z
  observation: API and Worker health alone cannot prove update success because cleanup, actual build, entrypoints and paired UI are conjunctive requirements and did not pass.
- timestamp: 2026-09-02T07:02:03Z
  observation: Both source configurations remain not_confirmed, school access remains not_started, Windows remains not_run/human_needed and Phase 3 remains blocked; no source/live boundary was crossed.
- timestamp: 2026-09-02T07:24:00Z
  observation: Sanitized installed-state projection identifies the active installation as 0.1.0-beta.19 with build ID 77548191f4a238a94c7ec0525ca8e51719c138040b9a1a489bea52a086e56741; healthy API/Worker therefore describe the old runtime, not beta.31.
- timestamp: 2026-09-02T07:25:00Z
  observation: The exact public beta.31 archive contains program/scripts/install/bootstrap.sh with TRUST_STATE, CORE_SHA256 and CORE_BASE64 all UNESTABLISHED. This is a source template that fails closed and is not a rendered release bootstrap.
- timestamp: 2026-09-02T07:26:00Z
  observation: The signed Phase 2 manifest binds capability/test/prompt-core hashes only. The public external prompt lists the two outer archives but no bootstrap URL/hash/command, signed installer manifest/signature, or program/node/browser component coordinates.
- timestamp: 2026-09-02T07:27:00Z
  observation: The earlier installation pipeline already assembles a standard signed ReleaseManifest, rendered bootstrap and installer/program/node/browser artifacts. Reusing that audited path is narrower and safer than inventing an archive-native replacement installer.

## Eliminated

- hypothesis: The failure can be accepted because API and Worker are healthy.
  reason: Plan 02-14 requires exact build/entrypoints, cleanup=complete and paired UI readiness together; multiple mandatory fields failed or were not observed.
- hypothesis: The failed result authorizes a retry of the same public beta.31 or immediate allocation of beta.32.
  reason: beta.31 is immutable and the post-human product failure must enter RELEASE-STABILIZATION R0/R1; no later candidate may be selected before the unnumbered rehearsal passes.

## Resolution

- root_cause: Phase 2 release assembly closed the capability-evidence archive but omitted the release-to-installation execution contract. Availability verification therefore proved only that evidence archives were downloadable and internally signed, not that an authenticated updater could transition the managed installation. The external prompt's instruction to run a managed update had no corresponding executable entrypoint. The real updater correctly left beta.19 active and returned ENTRYPOINT_MISMATCH.
- fix:
- verification:
- files_changed:
