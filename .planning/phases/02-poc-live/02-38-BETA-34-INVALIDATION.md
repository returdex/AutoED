---
phase: 02-poc-live
plan: 02-38
status: invalidated
version: 0.1.0-beta.34
class: POST_SOURCE
code: STALE_REHEARSAL_BUILD_ID
---

# Beta.34 invalidation

Beta.34 was selected locally after the prior unnumbered rehearsal, but the selection carried the old rehearsal build ID `82c8139d…`. The exact R3 build on the selected commit/tree produced `3ca40e6f…`, so candidate identity binding failed closed.

This is a source/process sequencing defect, not a product installation result. No signing, publication, remote mutation, installation, OS approval, restart, login, school access or Phase 2 advancement occurred. The locally selected beta number is permanently consumed and must not be retried or overwritten.

The corrective change makes rehearsal attestation writing verify the actual on-disk build identity and source hash. A fresh unnumbered R0/R1 rehearsal is required before assigning beta.35.
