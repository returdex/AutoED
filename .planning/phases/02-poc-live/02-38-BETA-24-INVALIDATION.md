# Phase 2 beta.24 invalidation

Status: `invalidated`

The immutable selection `0.1.0-beta.24` / `v0.1.0-beta.24` is permanently excluded from Phase 2 release use. Its original selection and complete quality receipts remain preserved in Git commits `18003e8` and `03affa2`; its signed-artifact receipt and external prompt remain preserved in commits `5c3a7b4` and `3f11232`. None may be restored as active canonical release state or used to create a tag, release, publication receipt, availability receipt, update handoff or live evidence.

Invalidated selected identity:

- Source commit: `435c983e06a71559bc764ce34f5099966d94d29e`
- Source tree: `c82c26962fe0654c6f78f4d5bb7e0dccb71ff2d4`
- Build ID: `0334678a9e462b2aea6ee32ccf6b00320bad13273baf89f8dca673eecb17c8eb`
- Source SHA-256: `e7e9d13a2494639d5ae52dadeb334f2d1c2c011267383b0d7119c2f844d4b7a4`
- Version-set SHA-256: `68ee95e20fa885872827dcad86a1ac87503d5817d0e98ee8a5d0e4b0d42b9203`
- Selection SHA-256: `c29631d87d131fd78ba5e970aa907e7c595c8be2037895786eec5ffd03d4e995`
- Test-report SHA-256: `b91a2458927a5607bc95ad4a0c551661fd414629b3728bc9425b29ebb476c43c`
- Signed-artifact receipt file SHA-256: `c0ab928e75bbf304f90d74ce03e901a6fe9036c859fb6b1e15d53b58b4ac2a1d`
- External install-prompt SHA-256: `de1e00fad401dea5f7f3c638c62d84a6611efc5359db927de40fc03508541cdf`
- macOS archive SHA-256: `b050d21c1eede056b1a965e8eaea5466fc7ac51ed4b09f7227fc7a973e074d01`
- Windows archive SHA-256: `5e06ce05a53dca5fa2698333247f82a4ed3745c291eb5d46938d060be4095e4a`

Invalidation basis:

- Plan 02-13 stopped before its publication mutation when GitHub returned HTTP 422 for the intentionally absent beta.24 tag lookup and the publisher compared the remote public-version digest with the distinct local consumed-version digest.
- RED commit `c4cabf0` proves that only the exact intended-tag `No commit found for SHA` HTTP 422 is absence, all other 422/errors remain fail-closed, public beta.1–20 remain distinct from locally consumed beta.1–24, and stale beta.24 cannot be reused.
- GREEN commit `0e189bc` implements those narrow semantics and requires exact active artifact/preflight identity before remote observation or mutation. The beta.24 source identity therefore no longer represents the corrected publisher that must be quality-bound and assembled.
- The prior beta.24 quality, signature and archive results are historical evidence for the old selected source only and are not reused for the replacement candidate.

Consumption check performed before invalidation:

- Unauthenticated GitHub release/tag observations and direct remote-tag observation ended at published `0.1.0-beta.20`; neither beta.24 nor beta.25 existed as a public, local or direct-remote tag, release or asset.
- No `release/phase2-publication.json` or `release/phase2-availability.json` existed. The failed Plan 02-13 attempt stopped before push, tag, release creation, asset upload or any other remote mutation.
- The ignored signed archives under `.runtime/releases/0.1.0-beta.24/` are preserved as local historical bytes. They are not active release state and must not be published, overwritten or relabelled.

The replacement candidate must be the next monotonically increasing unused identity and must rerun every Plan 02-38 quality and sensitive-scan gate from the beginning. Plan 02-39 must later assemble and sign fresh artifacts for that replacement identity; beta.24 signed bytes cannot be reused.
