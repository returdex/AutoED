---
status: diagnosed
trigger: "Published beta.44 projectless macOS arm64 update stopped safely at the mandatory preview gate with INVALID_INSTALLATION because the existing beta.19 installation receipt device did not match the current root device."
created: 2026-09-11T20:00:00+10:00
updated: 2026-09-11T20:24:00+10:00
---

# Debug Session: beta.44 installation device mismatch

## Symptoms

- Expected behavior: The exact availability-proven beta.44 updater validates the existing beta.19 installation, preserves managed data, completes the update and reports readiness plus cleanup=complete without source access or login.
- Actual behavior: Bootstrap validation passed, then the mandatory preview gate returned `INVALID_INSTALLATION` before activation.
- Error detail: The existing installation receipt's recorded filesystem device differs from the current root device, so ownership validation failed closed.
- Timeline: Observed during the first real projectless macOS arm64 beta.44 update attempt after R0-R5 passed.
- Reproduction: Run the exact signed beta.44 bootstrap against the existing staged beta.19 installation on its current root.
- Safety result: beta.19 stayed unchanged in staged state, beta.44 was not activated, no AutoED process remained, no school source was accessed, and no Profile data was inspected or copied.

## Current Focus

- hypothesis: confirmed — the schema-1 receipt treats macOS `st_dev` as a durable installation identity even though it is a mount-instance value and can change across boots while the same directory inode and UID remain stable.
- test: A sanitized local inspection proved that only the device comparison fails. The root protection, inode, UID, installation ID, active record, launcher hashes, old release signature and exact program/Node/browser file closures all still match.
- expecting: confirmed — beta.44 cannot repair this because its signed preview code rejects the schema-1 receipt before any authorized migration step.
- next_action: Obtain approval for an R0 recovery contract, implement it in source and tests, complete a fresh unnumbered R1, then request separate authorization before selecting beta.45.

## Evidence

- timestamp: 2026-09-11T20:00:00+10:00
  observation: User returned a sanitized projectless updater result with exact device mismatch and explicit non-activation/no-process/no-source-access boundaries.
- timestamp: 2026-09-11T20:12:00+10:00
  observation: The protected root and receipt retain required file types, link counts and modes; receipt inode and UID match the current root while only the device field differs. The receipt predates the current system boot.
- timestamp: 2026-09-11T20:18:00+10:00
  observation: Installation ID and active/launcher ownership records agree. The beta.19 manifest signature, active manifest/build binding, both launcher hashes and exact program/Node/browser file closures verify successfully without reading data, Profile or credentials.

## Eliminated

- hypothesis: Release download, hash, signature, trust fingerprint, capability closure, license, build identity or signed prompt-core failure.
  reason: The updater reported all of those checks passed before preview.
- hypothesis: Partial beta.44 activation caused the mismatch.
  reason: No beta.44 program directory was activated and beta.19 remained unchanged in staged state.
- hypothesis: The existing root was copied, replaced, linked, permission-weakened or corrupted.
  reason: Root/receipt structural checks, stable inode and UID, private permissions, installation/active/launcher bindings, signed old manifest and all managed program dependency closures passed. Only the volatile device number changed.

## Resolution

- root_cause: Schema-1 installation ownership requires exact equality of `st_dev`, inode and UID on every read and in generated launchers. On macOS, `st_dev` changed across the later boot even though the same protected root retained its inode, UID and complete signed installation identity. The preview therefore maps a legitimate remount to `INVALID_INSTALLATION`, and no signed legacy-device recovery transition exists.
- fix: Proposed R0 decision — add a narrowly scoped, auditable schema-1 migration in a later signed updater. It may run only when device is the sole legacy mismatch and canonical local-root protection, inode/UID, installation ID, active and launcher bindings, old release signature, complete old file closures, absence of owned processes and credential ownership all pass. Persist a schema-2 durable ownership record bound to a stable platform volume identity, never edit beta.44 or manually rewrite the old receipt, and generate launchers that validate schema 2.
- verification: Required before any candidate selection — focused positive restart/remount migration; negatives for inode/UID/path/volume/permission/installation ID/manifest/signature/closure/launcher/credential/process mismatch and interruption; existing installation/upgrade/recovery suites; complete managed R1 with dual-platform closure and no remote mutation.
- files_changed: Diagnosis record only. No source, test, release, installation or runtime file was changed by the controller.
