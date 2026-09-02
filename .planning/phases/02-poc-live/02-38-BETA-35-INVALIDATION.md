---
phase: 02-poc-live
plan: 02-38/02-39
status: invalidated
version: 0.1.0-beta.35
class: POST_SOURCE
code: DOWNLOAD_URL_DENIED
---

# Beta.35 invalidation

Beta.35 passed the fresh R0/R1 rehearsal, was selected once, and passed the complete R3 candidate gate. R4 then failed closed while rendering the signed bootstrap because `assembleManagedUpdater` generated the canonical `v0.1.0-beta.35` GitHub release URL, while `assertDownloadURL` accepted only historical no-`v` paths.

The candidate identity is permanently consumed. No public tag, release, asset, canonical receipt, installation, OS approval, restart, login, school access or live evidence was created. Initial macOS assembly output remains only in the ignored local diagnostic directory and is not eligible for reuse.

The corrective change accepts both historical no-`v` and canonical `v`-prefixed release tags and adds a regression test. A fresh unnumbered R0/R1 rehearsal is required before assigning beta.36.
