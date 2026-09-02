---
status: investigating
trigger: "Beta.33 R3 failed at two different host/process observation boundaries despite one intervening complete pass and no source drift."
created: 2026-09-02T11:40:00Z
updated: 2026-09-02T11:40:00Z
---

# Debug Session: beta.33 release-runner instability

## Symptoms

- R1 on the exact source passed 358 serial integration tests.
- Initial R3 failed `managed-cleanup` with `LOCAL_VOLUME_UNCONFIRMED_PREVIEW_INTENT`; `/sbin/mount` then completed in 0.01 seconds and the focused scenario passed.
- The first required fresh complete candidate gate passed all five suites.
- The second required fresh complete gate failed `upgrade-recovery` with `HUMAN_RECOVERY_REQUIRED`.
- Read-only process inspection found multiple orphaned `autoed-synthetic-*` API/Worker processes from interrupted historical test runs. They are test-only paths, not the user's beta.19 installation, but they show that interrupted runners can leave owned synthetic processes behind.

## Boundary

Do not weaken local-volume, process-ownership, host-ownership, cleanup or human-recovery checks. Do not select beta.34, sign, publish, update or log in while this session is unresolved.

## Next investigation

1. Capture the exact recovery `causeCode` instead of only the top-level safe code.
2. Add a pre/post suite synthetic-process ownership ledger and fail before tests when a prior run left owned processes.
3. Ensure interrupted test runs reclaim only processes whose command, root and ownership receipt all match the current synthetic run; never target the user's installed beta.19 or unrelated browsers/processes.
4. Separate local-volume probe availability from cleanup semantics and test the bounded probe deterministically without relaxing production fail-closed behavior.
5. Run a fresh unnumbered R1 only after the runner is clean and the focused process/mount group is stable.
