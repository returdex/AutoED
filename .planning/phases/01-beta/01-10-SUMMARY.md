---
phase: 01-beta
plan: "10"
subsystem: cross-platform-delivery
tags: [artifact-closure, macho, pe, native-diagnostics, chrome-for-testing, synthetic-manifest]
requires:
  - phase: 01-09
    provides: durable A-to-B upgrade, generation restart, rollback and exact cleanup
  - phase: 01-08
    provides: verified manifest envelopes, safe archive/link validation and bootstrap staging
provides:
  - auditable darwin-arm64 and win32-x64 delivery closure assembly
  - self-contained packaged synthetic diagnostics using only target production dependencies
  - actual macOS Node/browser/SQLite/Keychain/ACL evidence and honest Windows not_run ledger
  - blocked Phase 1 beta UAT procedure pending release trust and artifact availability
affects: [01-11 release manifests, 01-12 trust root, 01-13 beta publication, 01-14 native UAT]
tech-stack:
  added: []
  patterns: [target-only lockfile closure, full-tree machine-header audit, runtime evidence separate from static artifact metadata]
key-files:
  created: [scripts/build/assemble.mjs, scripts/build/native-artifacts.mjs, scripts/build/platform-matrix.json, scripts/test/native-report.mjs, docs/PHASE1-UAT.md]
  modified: [tests/integration/artifact-assembly.test.ts, tests/integration/two-build-upgrade.test.ts, tests/native/install-upgrade.test.ts]
key-decisions:
  - "Static delivery manifests describe closure evidence only; native pass results belong to a build-bound execution ledger and never a reusable matrix template."
  - "Windows delivery reuses only lockfile-selected pure JavaScript packages and exact Windows native prebuilds; mac node_modules is never copied as a Windows closure."
  - "The five official macOS browser framework links retain their verified relative target bytes; Windows delivery rejects every link."
patterns-established:
  - "Every regular delivery file is hashed, and every native-looking header or native extension is checked independently of its nominal component role."
  - "Packaged diagnostics resolve production modules inside their own delivery tree and emit sanitized result codes rather than paths or secrets."
requirements-completed: []
duration: 40m
completed: 2026-08-27
---

# Phase 1 Plan 10: Cross-Platform Artifact and Native Evidence Summary

**Target-only Darwin and Windows delivery trees now carry exact archive provenance, complete file hashes, packaged diagnostics, and an honest split between macOS native execution and unrun Windows behavior.**

## Performance

- **Duration:** 40 minutes
- **Completed:** 2026-08-27
- **Tasks:** 2 TDD tasks
- **Files modified:** 8 source/test/document files

## Accomplishments

- Downloaded the fixed official Node 24.20.0 and Chrome for Testing 151.0.7922.34 archives without proxy or redirects, enforced transfer limits, and recorded their exact complete hashes and sizes. Node hashes matched the previously pinned official SHASUMS values.
- Built separate Darwin ARM64 and Windows x64 production closures from non-dev lockfile entries. Each closure contains only its selected `better-sqlite3` and `@napi-rs/keyring` native binary; incompatible optional packages and `fsevents` are excluded.
- Audited every delivery file and link. Machine validation scans all `.node`, `.exe`, `.dll`, `.dylib`, Mach-O, and PE files regardless of component label, so a foreign binary cannot hide under a pure-JavaScript role.
- Assembled actual A/B × Darwin/Windows trees containing compiled applications, installer/bootstrap/selfcheck code, PolyForm license, target Node/browser, production modules, and `native-report.mjs`. The packaged Darwin Node ran diagnostics with delivery-root `cwd`, no `NODE_PATH`, and verified SQLite resolution inside `program/node_modules`.
- Exercised the real installed A (`0.1.0-beta.1`, echo) to B (`0.1.0-beta.2`, echo+digest) CLI/MCP/API/Worker upgrade, plus macOS Node/browser/SQLite backup/Keychain/ACL probes. Windows executable behavior remains explicitly `not_run`.

## Task Commits

1. **10-1 RED: require auditable cross-platform delivery closure** - `ea9372e`
2. **10-1 GREEN: assemble auditable target delivery trees** - `ea8f666`
3. **10-2 RED: require packaged native delivery evidence** - `c4df8cb`
4. **10-2 GREEN: verify self-contained beta delivery matrix** - `7d4c907`
5. **Evidence correction: separate assembly from native run evidence** - `92daff0`

## Artifact Provenance Observed

| Artifact | Bytes | SHA-256 / integrity | Evidence |
|---|---:|---|---|
| Node 24.20.0 darwin-arm64 | 52,813,331 | `40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8` | Full download; official pinned hash matched |
| Node 24.20.0 win32-x64 | 37,539,751 | `6cac9ffbca8f6a47091e4b5c772e0606049c3871cb67d900c0cedde630e545ba` | Full download; official pinned hash matched |
| Chrome for Testing 151.0.7922.34 mac-arm64 | 187,406,357 | `01a23ef9501b2745e0c2944c2e583207e6f6132d8d91c3a87ff65b5079e438ef` | Full official archive download; 5 reviewed relative framework links |
| Chrome for Testing 151.0.7922.34 win64 | 201,068,834 | `045621e45a9dd27002c7fc1d8e10fe9f5f71f4cadbf44ec6f397f56f0179725c` | Full official archive download; 0 links |
| `@napi-rs/keyring-win32-x64-msvc@1.3.0` | 739,076 | lockfile SHA-512 `4DnCWXwDc0HRKwyRlG5y0VhKZW2tNRQfKKfyj6IX/KWfDNyq9hn4n+GL1auyDcOO/v8PwnhmYo2+rOOqCkvvOg==` | Full registry tarball; lock integrity matched |

These observations are recorded in synthetic build-manifest provenance. They are not Plan 12 release signatures or a production trust root.

## Decisions Made

- Only the required Node executable and Node license enter each delivery. npm/corepack archive links are not needed by the product runtime and are not copied into the managed runtime.
- `cpSync` must use `verbatimSymlinks:true` for the official macOS browser. Node otherwise rewrites relative targets into absolute source paths, which correctly fails the delivery link policy.
- Static `platform-matrix.json` remains `static_only`/`not_run` for Darwin native execution and `not_run` for Windows. The actual macOS pass is recorded here as execution evidence and must be rebound to the final Plan 13 build identity before publication.
- The diagnostic runner accepts only three fixed scenarios and an explicitly supplied owned temporary root. It has no URL, selector, command, Profile, school-data, trust-key, or arbitrary filesystem operation input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Validated native files across the complete tree instead of trusted component labels**
- **Found during:** Task 2 closure review
- **Issue:** Initial machine checks filtered by known component roles, allowing a foreign native file hidden under a nominal pure-JavaScript component to escape validation.
- **Fix:** Read bounded headers for every regular file and require the target architecture for native extensions or Mach-O/PE magic. Added a hidden wrong-architecture DLL regression.
- **Committed in:** `7d4c907`

**2. [Rule 1 - Bug] Preserved official browser relative link bytes during staging**
- **Found during:** Task 2 packaged assembly
- **Issue:** Node `cpSync` rewrote the five legitimate relative framework links into absolute source paths, causing `LINK_GRAPH_INVALID`.
- **Fix:** Used `verbatimSymlinks:true`; the strict descendant graph policy remained unchanged and all four delivery trees passed audit.
- **Committed in:** `7d4c907`

**3. [Rule 2 - Evidence integrity] Removed native pass claims from static assembly inputs**
- **Found during:** Post-GREEN review
- **Issue:** A static platform template briefly encoded the current macOS native pass, which would make future deliveries inherit evidence they had not run.
- **Fix:** Restored static-only/not-run metadata and added assertions that assembly can never manufacture a native pass. Actual execution evidence remains separate.
- **Committed in:** `92daff0`

**4. [Rule 2 - Test correctness] Added the platform-specific production closure and packaged resolver proof**
- **Found during:** Task 2
- **Issue:** Source-run diagnostics could resolve repository dependencies and could not prove a self-contained Windows closure.
- **Fix:** Derived non-dev package paths from the lockfile, selected one native package per target, and ran the packaged diagnostic with packaged Node, minimal environment, delivery `cwd`, and an internal containment check.
- **Committed in:** `7d4c907`

---

**Total deviations:** 4 auto-fixed (2 security/evidence, 2 correctness). No dependency, product permission, release key, remote, tag, publication, or school/Profile access was added.

## Issues Encountered

- The first mac native run used an unapproved credential label and failed with `INVALID_CREDENTIAL` before writing a key or launching the browser. The test switched to the existing `native-test` allowlist; its exact UUID entry and root were then cleaned successfully.
- The first packaged assembly expected diagnostics at the staging root while the final layout correctly placed it under `program/diagnostics`. The gate now accepts that fixed packaged location without allowing diagnostics to be omitted.
- The first link-preserving copy rewrote official relative links. The staging fixture was removed before retry; no foreign process or binary ran during either failure.
- The static matrix evidence issue was caught after GREEN and fixed in a separate atomic commit. Final artifact reports remain honest even when native tests are not run.

## Automated Evidence

- Artifact assembly: **5/5 passed**.
- Two-build integration: **7/7 passed** in 141.70 seconds after the evidence-semantics correction; actual four-tree packaged assembly and real CLI/MCP/API/Worker A-to-B upgrade both passed.
- Native install/upgrade: **3/3 passed** in 1.11 seconds after the correction. The current macOS ARM64 run exercised downloaded Node and browser bytes, SQLite backup/reopen, a fresh precisely deleted Keychain entry, and ACL checks.
- TypeScript `--noEmit`: exited 0.
- Windows native execution: **not_run**. Static PE/header/closure/hash/link evidence is not a substitute.

### Independent final regression

- Root independently ran **156/156 Vitest tests across 29 files** in 909.92 seconds.
- Root independently ran **10/10 UI tests** in 3.3 seconds.
- Independent `tsc --noEmit` exited 0.
- Independent production build exited 0 with four actual entries and identity `f1ba5c6480ca135dc367031544c5ed413059fcecb5c7cb67f0ef6a7088950dc4`.
- No release or tag was created.

All signed A/B manifests used an ephemeral synthetic fixture key. No published beta, production release trust, real user login, long-lived Codex MCP reload, Windows execution, release, or tag was proven.

## Known Stubs

- Production release trust remains fail-closed until Plan 12 establishes the approved public root and custody workflow.
- The UAT document is intentionally blocked until Plan 13 publishes and independently verifies obtainable beta artifacts.
- Native Windows installation, browser launch, Keyring, PowerShell wrapper/child EOF, recovery, and cleanup remain `not_run` for Plan 14.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: artifact-file-access | `scripts/build/assemble.mjs` | Copies only explicitly staged target components into a new output root, hashes the exact tree, and refuses existing output or unsafe sources. |
| threat_flag: native-execution | `scripts/test/native-report.mjs` | Runs fixed synthetic local diagnostics under packaged Node; accepts no arbitrary command, URL, selector, or school/Profile input. |

## User Setup Required

None. No OS prompt, login, release-key action, publication, or live UAT occurred.

## Next Phase Readiness

- Plan 11 can consume the target-specific closure and exact archive provenance to produce signed release manifests and publication artifacts, but must preserve synthetic-vs-release trust separation.
- Plan 12 must establish the actual release public key and private-key custody through the required human gate. No fixture key may be promoted.
- Plan 13 must rebuild/rebind native execution evidence to the final approved build identity, publish without overwriting a tag, and verify availability before UAT is requested.
- Plan 14 must execute the full native Windows ledger and the blocked UAT document. macOS evidence cannot fill those cells.

## Self-Check: PASSED

All five plan/fix commits exist, all eight listed source/test/document files exist, the summary records only targeted executor evidence, and no root-owned planning document is staged.

---
*Phase: 01-beta*
*Completed: 2026-08-27*
