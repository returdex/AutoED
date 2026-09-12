---
status: invalidated
classification: HUMAN_PRODUCT
version: 0.1.0-beta.45
date: 2026-09-13
availability: pass
active_candidate: none
---

# Beta.45 immutable invalidation

Beta.45 completed R2-R5, was published once with sixteen assets, and passed its single anonymous full availability verification. Its real macOS arm64 bootstrap verified all fixed release, signature, closure, trust, license, build and signed prompt-core coordinates, then the signed installer stopped before recovery preview with `INSTALLATION_RECOVERY_UNCONFIRMED`.

The updater was mistakenly run in a saved FIT5046 project task rather than the required local projectless task, was invoked twice, and later wrote/pushed FIT5046 documentation. Those actions violated updater-task boundaries. They do not make beta.45 retryable because the signed installer did run against the real managed root and reproduced a product recovery failure.

Bounded read-only stage diagnostics identified `INSTALLATION_RECOVERY_UNCONFIRMED_CLIENTS`. The retained inventory had 214 structurally valid leases: 212 recorded PIDs were absent, two PIDs had been reused by unrelated processes, zero exact owned AutoED client processes were running, and no lease was invalid. Beta.45 incorrectly treated every occupied PID as the original client without comparing the recorded OS start identity and executable.

No beta.45 program was activated, beta.19 remains unchanged in `staged` state, no AutoED process remains, no school source/login/Profile access occurred, and no cleanup/readiness or live receipt exists. Beta.45 is permanently consumed immutable `HUMAN_PRODUCT` history. Its tag, release, assets and historical Git evidence must not be retried, overwritten, deleted or relabelled.

The corrective R0 distinguishes exact owned-running processes from PID reuse, binds the complete inactive lease inventory into the recovery scope, reruns every recovery proof after exact human confirmation before committing the schema migration, emits allowlisted stage-specific failure codes, and signs projectless/one-shot/no-workspace-write constraints into future prompts. A complete fresh unnumbered R1 and separate beta.46 authorization are still required. Signing, publication, installation, login, 02-15 and Phase 3 remain unauthorized.
