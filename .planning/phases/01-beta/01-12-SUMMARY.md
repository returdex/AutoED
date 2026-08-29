---
phase: 01-beta
plan: "12"
subsystem: release-trust
tags: [ed25519, macos-keychain, github-oauth, returdex, human-gate]
requires:
  - phase: 01-11
    provides: fail-closed trust, release preflight and history scanning tools
provides:
  - explicit user approval receipt for local Ed25519 release-key custody
  - fixed public trust root backed by a non-exported macOS Keychain private key
  - isolated returdex GitHub authentication and exact-name-free repository prerequisite
affects: [01-13 signed beta publication, 01-14 user update UAT]
requirements-completed: []
completed: 2026-08-29
---

# Phase 1 Plan 12: Release Trust and Remote Identity Gate Summary

**The user explicitly approved local release-key custody, confirmed the public fingerprint, completed isolated `returdex` OAuth, and renamed the pre-existing repository before any new remote was created.**

## Human gate evidence

- The user approved one Ed25519 private release key stored only in the local OS Keychain service `AutoED-Rebuild-Release`. The key is not a platform code-signing certificate, is not exported, and is not authorized for cloud CI.
- The public fingerprint was displayed and explicitly confirmed as `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557`.
- GitHub OAuth ran under the protected isolated configuration. The user completed the official device flow as `returdex`; the existing unrelated SSH public key was not uploaded and the global active account remained unchanged.
- The first exact-name check found a pre-existing, nonempty public `returdex/AutoED`. Execution stopped. The user renamed it to `returdex/AutoED-legacy`; a subsequent canonical check proved that the old endpoint redirects to the renamed repository and no exact `returdex/AutoED` repository currently exists.

## Implemented evidence

- `release/approval.json` records only the approved scope and confirmation signal, with no secret.
- `release/trust-root.json` contains only the Ed25519 public key, fingerprint, approval hash and fixed Keychain identifiers. Its working-tree permission was verified as `0600`; it has no private-key field.
- `release/prerequisites.json` records the confirmed fingerprint, successful Keychain selfcheck, isolated login, unchanged global identity, repo-local author/committer, protected isolated configuration, renamed-repository canonical observation and absence of a local remote. It contains no token or filesystem credential.
- `trust.mjs` gained fixed `check-approval`, `init`, `selfcheck` and `sign` commands because the approved Plan 12 commands were absent from the Plan 11 implementation. Initialization refuses an existing unknown key and writes the private PKCS#8 material directly to Keychain; stdout contains only public hashes. Selfcheck signs a random challenge. Signing accepts only repository-owned paths and writes a new non-overwriting signature file.
- `preflight.mjs --identity-only` independently rechecks the isolated and global login identities, local Git identity, exact repository name, remote absence, directory protection, approval hash and public fingerprint.

## Commits

1. `c076da9` — approve and gate local release trust
2. `8f7e0c8` — establish isolated release prerequisites

## Verification

- Targeted release trust/gates: **10/10 passed**; TypeScript passed.
- Independent full regression: **166/166 Vitest tests passed** across 31 files in 1012.53s; **10/10 UI tests passed** in 3.6s; TypeScript passed.
- Production build: four actual entries, identity `7fc312903274cb70a8912d76afbc836ddb33a372a212cd9e98c4fa42875ee067`; no release or tag created.
- Real Keychain random-challenge selfcheck: passed for the confirmed fingerprint.
- Actual identity-only preflight: isolated login `returdex`, exact name absent, global identity unchanged.
- Bounded reachable-history scan: passed at current repository `HEAD`, 363 blobs, 3 exact reviewed fixture exceptions, 16.75s.

## Boundaries and remaining gates

- No repository, remote, tag, release, asset, upload or push was created in this plan.
- The public root is real, but no beta has yet been signed or published. Publication and anonymous availability evidence belong to Plan 13.
- Windows native execution remains `not_run`; this macOS trust evidence cannot fill Windows or user UAT cells.
- No school login, Profile, course data, legacy repository write or Phase 2 work occurred.

## Self-Check: PASSED

The approval, public trust root and prerequisites exist; Keychain selfcheck and identity-only preflight pass; the repository has no remote; no private key or token is present in tracked files.

---
*Phase: 01-beta*
*Completed: 2026-08-29*
