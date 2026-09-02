# Beta.37 public availability failure

Date: 2026-09-02
Candidate: `0.1.0-beta.37`
Tag: `v0.1.0-beta.37`
Classification: `POST_PUBLIC`

## Sanitized result

- R0/R1 rehearsal: pass.
- R2 selection, R3 qualification, R4 signed dual-target assembly and local verification: pass.
- R5 publication: pass; the immutable GitHub release and tag were created with 16 assets (8 macOS, 8 Windows).
- R5 bounded anonymous metadata/HEAD readiness: reached the full-verifier stage.
- R5 one-time anonymous full byte/hash/signature/closure verifier: failed with `PHASE2_AVAILABILITY_FAILED`.
- `release/phase2-availability.json` was not written.
- No update, OS approval, restart, school login, course access or Phase 2 live receipt occurred.

Read-only release metadata after the failure showed the expected immutable release identity, 16 asset entries, sizes and server-reported SHA-256 digests matching the local publication receipt. The verifier did not provide a more specific non-sensitive cause, so no narrower root-cause claim is made.

## Required handling

Beta.37 is permanently consumed and must not be retried, overwritten, deleted, relabelled or used for human update. Future repair must return to R0/R1, diagnose the full-verifier failure, and select a later beta only after the complete stabilization policy passes again. Phase 1, Windows native evidence, live evidence and Phase 3 remain blocked.
