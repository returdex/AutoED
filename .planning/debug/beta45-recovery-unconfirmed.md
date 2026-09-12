---
status: resolved
trigger: "Published beta.45 macOS arm64 update passed bootstrap validation but stopped before recovery preview with INSTALLATION_RECOVERY_UNCONFIRMED."
created: 2026-09-13T00:00:00+10:00
updated: 2026-09-13T00:47:17+10:00
---

# Debug Session: beta.45 recovery unconfirmed

## Symptoms

- Expected behavior: The availability-proven beta.45 updater validates the retained beta.19 installation, emits the bounded legacy-device recovery preview, requires exact human confirmation, migrates the receipt to schema 2, then continues the ordinary update preview without accessing school sources or the dedicated browser Profile.
- Actual behavior: Release coordinates, target bytes, SHA-256 values, manifest/signature/closure/trust/license/build/prompt-core and bootstrap integrity passed, but the installer returned `INSTALLATION_RECOVERY_UNCONFIRMED` before any recovery preview.
- Safety result: beta.19 remains unchanged in `staged` state; beta.45 was not activated; no AutoED process remains; no school source, login, Profile copy/backup/inspection or course deletion occurred; cleanup/readiness and live evidence were not obtained.
- Context violation: The updater ran from a saved FIT5046 project task rather than the required local projectless task, then wrote and pushed two FIT5046 documentation commits. This is separately out of updater scope. Because the signed installer nevertheless ran twice against the real managed root, the second attempt does not erase the first product failure and beta.45 is not retryable.

## Current Focus

- hypothesis: confirmed — the recovery implementation collapsed eight independent checks into one generic code, and its client check treated any occupied PID as the recorded client even when OS start identity and executable proved PID reuse by an unrelated process.
- test: Allowlisted stage diagnostics returned `INSTALLATION_RECOVERY_UNCONFIRMED_CLIENTS`; a second aggregate-only read classified all 214 leases without exposing their contents; after the correction, the same read-only recovery preparation returned pass.
- expecting: confirmed — 212 recorded PIDs were absent, two were unrelated replacements, zero exact owned clients were running and all leases were structurally valid.
- next_action: Stop after corrective R0. A complete fresh unnumbered R1 and any beta.46 selection require separate authorization.

## Evidence

- timestamp: 2026-09-13T00:00:00+10:00
  observation: User returned the strict sanitized beta.45 result: all fixed release and signature coordinates passed, followed by `INSTALLATION_RECOVERY_UNCONFIRMED` before recovery confirmation or activation.
- timestamp: 2026-09-13T00:00:00+10:00
  observation: Read-only Codex task metadata shows the updater task was attached to the saved FIT5046 project, not projectless. Its history shows two bootstrap invocations and subsequent FIT5046 documentation commits/pushes.
- timestamp: 2026-09-13T00:00:00+10:00
  observation: Source inspection shows `prepareInstallationIdentityRecovery` catches every post-identity failure and rewrites it to the same `INSTALLATION_RECOVERY_UNCONFIRMED` code.
- timestamp: 2026-09-13T00:37:00+10:00
  observation: The first allowlisted read-only preparation returned `INSTALLATION_RECOVERY_UNCONFIRMED_CLIENTS`. Aggregate-only classification found 214 valid leases: 212 exited, two PID-replaced, zero exact owned running and zero invalid.
- timestamp: 2026-09-13T00:40:00+10:00
  observation: After exact ownership comparison and scope revalidation were implemented, the same read-only preparation returned `INSTALLATION_RECOVERY_READ_ONLY_PASS`; no confirmation or commit path was invoked.
- timestamp: 2026-09-13T00:47:17+10:00
  observation: Managed typecheck, release-gate integration 46/46, ownership-recovery integration 3/3 and `git diff --check` passed. These are focused R0 results, not a complete R1 attestation.

## Eliminated

- hypothesis: beta.45 download, archive hash, signature, trust fingerprint, capability closure, license, build identity or signed prompt-core failed.
  reason: The updater's sanitized result explicitly reports each of these checks passed.
- hypothesis: beta.45 activated partially or altered beta.19 before failure.
  reason: The returned result reports no beta.45 activation, unchanged beta.19 state and no remaining AutoED process.
- hypothesis: The project-attached context makes beta.45 safe to retry.
  reason: `UPDATE_TASK_CONTEXT_INVALID` permits reuse only when the updater refuses before running. Here the verified bootstrap and signed installer actually ran against the real managed root, twice, and produced a product recovery failure.

## Resolution

- root_cause: `inspectClientHostsForRecovery` rejected every non-null PID observation without calling the existing exact ownership comparator. Two historical client PIDs had been reused by unrelated processes, so the beta.45 updater falsely classified inactive leases as live. The surrounding recovery catch erased this distinction. Separately, the external updater task was not projectless and the prompt did not itself bind projectless, one-shot or no-workspace-write behavior.
- fix: Compare the stored OS start identity and executable before treating a client or service as running; accept absent and PID-replaced observations without signalling or deleting anything. Bind the sorted inactive lease receipts and process records into a v2 recovery scope, rerun the complete proof after exact confirmation, and fail stale on any drift. Emit only fixed stage codes. Add the projectless, no-workspace-write and exactly-once bootstrap rules to both the signed prompt core and exact external prompt.
- verification: Managed typecheck passed; `phase2-release-gates` passed 46/46; `installation-ownership-recovery` passed 3/3 including exact-live rejection, PID-reuse acceptance, stage codes and confirmation-time lease/receipt drift; the corrected real-root read-only preparation passed. No complete R1 was run or claimed.
- files_changed: Recovery/client source, prompt renderers, focused integration tests, release policy/state/invalidation records and active beta.45 pointer retirement. The real installation, Profile and unrelated project files were not changed by this controller.
