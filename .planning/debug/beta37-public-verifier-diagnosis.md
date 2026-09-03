---
status: investigating
trigger: "beta.37 public availability verifier failed after publication"
created: 2026-09-03
updated: 2026-09-03
---

# Beta.37 public verifier diagnosis

## Symptoms

- Expected: one anonymous full-byte/hash/signature/closure verifier produces `release/phase2-availability.json` after the bounded metadata/HEAD readiness gate.
- Actual: the verifier returned `PHASE2_AVAILABILITY_FAILED`; no availability receipt was written.
- Observed context: publication succeeded, remote metadata and asset inventory were present, and the candidate is permanently consumed under `POST_PUBLIC`.

## Current Focus

- hypothesis: a transport/header or remote-byte condition differs from the local signed artifact, despite matching release metadata.
- test: perform bounded focused checks on small public assets only; do not rerun the full verifier.
- expecting: identify whether the failure occurs before archive parsing, without making a pass claim.
- next_action: compare focused public responses with the immutable local receipt, then return to R0/R1 for any repair.

## Evidence

- timestamp: 2026-09-03
  observation: Remote release has 16 assets; server-reported sizes and SHA-256 digests match the local publication receipt.
- timestamp: 2026-09-03
  observation: Focused anonymous GET checks for six small bootstrap/manifest/signature assets returned HTTP 200 with expected lengths and SHA-256 values.
- timestamp: 2026-09-03
  observation: Focused anonymous HEAD checks for all 16 assets returned HTTP 200 with expected content lengths.
- timestamp: 2026-09-03
  observation: Streamed GET checks for the macOS and Windows outer archives returned HTTP 200 with expected lengths and SHA-256 values.
- timestamp: 2026-09-03
  observation: Anonymous GitHub release metadata request returned HTTP 200; no API-rate or metadata failure was observed during diagnosis.

## Resolution

- root_cause: unresolved; the original verifier collapses asset-level and archive-level failures into `PHASE2_AVAILABILITY_FAILED`, and the permitted focused checks did not reproduce it.
- fix: pending
- verification: focused transport checks pass; the one full verifier attempt remains failed and must not be repeated.
- files_changed: []
