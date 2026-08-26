---
phase: 01-beta
plan: "11"
subsystem: release-trust
tags: [ed25519, release-manifest, secret-scan, immutable-beta, anonymous-availability]
requires:
  - phase: 01-10
    provides: target-specific artifact closures, exact archive provenance and native evidence boundaries
  - phase: 01-08
    provides: strict release manifest schema and verified manifest brands
provides:
  - fail-closed production release trust policy pending Plan 12 approval
  - exact manifest serialization and bootstrap public-key/Node-hash binding
  - independent identity, immutable beta, license, package and reachable-history preflight gates
  - pure Plan 13 publish planning and anonymous full-byte availability verification
affects: [01-12 trust approval, 01-13 beta publication, 01-14 UAT availability gate]
tech-stack:
  added: []
  patterns: [exact-byte Ed25519 envelopes, immutable reviewed-blob exceptions, injected external-service adapters]
key-files:
  created: [scripts/release/trust.mjs, scripts/release/manifest.mjs, release/trust-policy.json, scripts/release/preflight.mjs, scripts/release/publish.mjs, scripts/release/verify-availability.mjs, docs/RELEASE.md]
  modified: [tests/integration/release-trust.test.ts, tests/integration/release-gates.test.ts]
key-decisions:
  - "Production signing remains unavailable until Plan 12 supplies an approved receipt and OS-keyring trust root; synthetic key generation exists only inside an integration test."
  - "A public release is not available until an anonymous client retrieves every exact byte and a manifest verifier relates the complete byte map to its signed manifest."
  - "Reviewed scanner fixtures are exempt only by immutable Git object hash plus exact approved source path; changed bytes, changed paths, runtime paths and new matches fail."
patterns-established:
  - "Release tooling returns sanitized codes and immutable plans; external GitHub and fetch behavior enters only through separately approved adapters."
  - "Source publication scans the exact reachable history, not only the worktree or .gitignore state."
requirements-completed: []
duration: 12m
completed: 2026-08-27
---

# Phase 1 Plan 11: Release Trust and Publication Gates Summary

**Fail-closed Ed25519 trust, immutable release preflight, reachable-history scanning, and anonymous full-byte availability gates are ready without creating a key, repository, tag, release, or authenticated session.**

## Performance

- **Duration:** 12 minutes
- **Completed:** 2026-08-27
- **Tasks:** 2 TDD tasks
- **Files modified:** 9 source/test/document files

## Accomplishments

- Added a fixed public trust policy whose key, fingerprint, and approval receipt are null. Production signing throws `RELEASE_TRUST_NOT_ESTABLISHED`; Plan 11 never accesses the OS keyring or generates a production key.
- Validated and serialized the existing strict release manifest schema into exact signed bytes. Tests reject changed bytes, changed keys, bad signatures, downgrade replay, and bootstrap public-key fingerprint or Node-hash drift.
- Separated repo-local author/committer identity, isolated remote login identity, and same-name repository ownership. Only `returdex/AutoED` with an exact approved creation receipt may proceed.
- Enforced immutable `0.1.0-beta.N`, the unmodified PolyForm Noncommercial license and licensing notice, bounded public-package allowlists, secret/runtime denial, and bounded scanning of every blob reachable from an explicit Git tree.
- Kept publication as a pure immutable plan requiring a Plan 13 receipt. Anonymous availability refuses redirects and requires exact GitHub URL, status, content length, full bytes, SHA-256, and a manifest verifier over the complete downloaded asset map.

## Task Commits

1. **11-1 RED: require fail-closed release trust** - `8545497`
2. **11-1 GREEN: add fail-closed release trust tools** - `3e40d1b`
3. **11-2 RED: require immutable sanitized release gates** - `ae9e4ed`
4. **11-2 GREEN: enforce immutable sanitized release gates** - `b3390cf`
5. **Scanner evidence fix: bind reviewed fixtures by object hash** - `7fdd8ca`

## Files Created/Modified

- `release/trust-policy.json` - public, unestablished production trust state and fixed OS-keyring service metadata.
- `scripts/release/manifest.mjs` - strict schema validation and exact manifest-byte serialization.
- `scripts/release/trust.mjs` - fail-closed policy loader and public bootstrap fingerprint/Node-hash verifier.
- `scripts/release/preflight.mjs` - identity, conflict, version, license, package and bounded reachable-history gates.
- `scripts/release/publish.mjs` - pure immutable publication plan requiring an exact Plan 13 approval receipt.
- `scripts/release/verify-availability.mjs` - injected anonymous full-byte retrieval and manifest-relation verification.
- `docs/RELEASE.md` - first-trust, identity, source scan, stop condition, immutable beta and UAT-availability procedures.
- Release integration tests - actual rejection behavior for trust, tamper, identity, conflict, overwrite, license, secret history and public retrieval.

## Decisions Made

- The production trust module contains no synthetic key generator or arbitrary private-key input. The only ephemeral Ed25519 private keys are local variables inside `release-trust.test.ts`; they never enter a file, keyring, argument, environment, artifact, policy or output.
- Remote publication cannot be triggered from Plan 11. `createPublishPlan` only returns a frozen description after an exact Plan 13 receipt; it has no shell, `gh`, network, environment, tag or upload path.
- A same-name repository without the exact approved Plan 12 creation receipt is a conflict even when its owner string is `returdex`; the tool never adopts it by assumption.
- Windows native remains `not_run`. Static Plan 10 closure evidence may support a beta ledger but cannot support cross-platform completion or UAT acceptance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Evidence integrity] Required manifest relation after anonymous asset retrieval**
- **Found during:** Task 2 GREEN review
- **Issue:** Exact HTTP bytes and hashes alone did not prove that the downloaded set belonged to the signed release manifest.
- **Fix:** Availability now passes the complete downloaded byte map to a required manifest verifier and records its manifest hash; HTTP 200 alone and verifier failure are rejected.
- **Committed in:** `b3390cf`

**2. [Rule 2 - Security] Added explicit reachable-source path allowlisting**
- **Found during:** Task 2 GREEN review
- **Issue:** Content scanning alone could allow an unexpected class of source file into public history.
- **Fix:** Every reachable blob must also belong to the approved root-file or top-level source classes; forbidden runtime/config/private paths fail before publication.
- **Committed in:** `b3390cf`

**3. [Rule 1 - Scanner correctness] Bound self-referential fixture findings to immutable Git objects**
- **Found during:** Actual current-HEAD scan
- **Issue:** The scanner correctly found three historical blobs containing its own detector or negative-test literal. Rewriting history was prohibited, while a broad path exemption would weaken future scans.
- **Fix:** Reviewed exactly three immutable `(object hash, approved scanner/test path, reason)` tuples and split future literals. Same content under another path, changed hash, runtime path, and every new match still fail.
- **Committed in:** `7fdd8ca`

---

**Total deviations:** 3 auto-fixed (2 security/evidence, 1 scanner correctness). No product permission, dependency, production trust root, real private key, remote action or publication capability was added.

## Issues Encountered

- Initial RED suites failed on absent release modules as intended.
- TypeScript found four implicit test parameter types after Task 2 GREEN. Explicit mock types fixed the test-only compile failure; production modules required no type workaround.
- The first bounded scan of this repository's `HEAD` returned `SOURCE_HISTORY_REJECTED` with three pattern findings, zero disallowed paths and zero oversized blobs. No match content was printed. After exact reviewed-object exceptions, the same boundary passed without rewriting history.

## Automated Evidence

- Plan 11 integration tests: **8/8 passed** across the two release test files.
- TypeScript `--noEmit`: exited 0.
- Bounded source-history scan: `pass`, boundary current repository `HEAD`, 350 blobs scanned, 3 exact reviewed fixture exceptions.
- No `gh`, remote, authenticated fetch, keyring, key generation outside test memory, OS prompt, repository creation, tag, release, upload or push occurred.

These are local synthetic/integration tools and mocked service tests. They do not establish production release trust, authenticate `returdex`, prove repository availability, publish a beta, verify a real public download, run Windows native tests, or authorize UAT.

## Known Stubs

- `release/trust-policy.json` intentionally remains `unestablished` with null public key, fingerprint and approval receipt. Plan 12 is a hard human/OS authorization gate.
- Publication is a frozen plan only. Plan 13 must use the approved isolated GitHub configuration and receipt to perform and verify real remote actions.
- Anonymous availability is tested with an injected mock fetch. A real version-bound availability record remains absent until Plan 13.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: release-trust | `scripts/release/trust.mjs` | Validates public trust pins while production private-key use remains unavailable. |
| threat_flag: source-history | `scripts/release/preflight.mjs` | Reads bounded Git objects from an explicit repository/tree and returns sanitized pass/reject results. |
| threat_flag: public-download | `scripts/release/verify-availability.mjs` | Retrieves only expected immutable GitHub asset URLs through an injected anonymous adapter and validates all bytes. |

## User Setup Required

None in this plan. Plan 12 will request the separate release trust/key custody and isolated GitHub authorization actions; this plan did not attempt them.

## Next Phase Readiness

- Plan 12 must establish the fixed public key/fingerprint and protected approval receipt through the required human gate. A fixture key cannot be promoted.
- Plan 13 must separately verify repo-local identity, isolated `returdex` login, same-name repository reality, new immutable beta numbers, actual public history/package scans, publication, and anonymous availability.
- Plan 14 remains blocked until obtainable beta evidence exists. Windows native and all human UAT cells remain `not_run`.

## Self-Check: PASSED

All five task/fix commits exist, all nine listed files exist, current `HEAD` passed the bounded history scan, and no root-owned planning document or Plan 12 file is staged.

---
*Phase: 01-beta*
*Completed: 2026-08-27*
