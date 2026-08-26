---
phase: 01-beta
plan: "03"
subsystem: platform
tags: [native, keychain, credential-manager, permissions, paths, installation]
requires:
  - phase: 01-01
    provides: Managed Node 24.20.0, exact keyring 1.3.0, shared SecretStore port and owned test harness
provides:
  - Actual platform detection, protected isolated roots and fail-closed local-volume/path checks
  - Exact UUID-namespaced native credential adapter with no enumeration or plaintext fallback
  - Scope/destination-bound token digests, immediate rotation/revocation and generation-bound selfcheck credentials
  - Nonsecret installation metadata and pre-provisioning exact-namespace recovery intent
affects: [01-04, 01-05, 01-06, 01-08, 01-09, 01-10, 01-14]
tech-stack:
  added: []
  patterns: [native DACL and POSIX ACL verification, exclusive root creation, exact credential namespace, flushed initialization intent]
key-files:
  created: [packages/platform/src/paths.ts, packages/platform/src/permissions.ts, packages/platform/src/platform.ts, packages/platform/src/credentials.ts, packages/platform/src/installation.ts, tests/native/platform-probes.test.ts, tests/native/secret-store.test.ts, tests/unit/credential-redaction.test.ts]
  modified: []
key-decisions:
  - "Known legacy exclusions are intrinsic; callers may add exclusions but cannot remove them."
  - "Existing unknown roots are never adopted, chmodded, or overwritten by initialization."
  - "The exact nonsecret initialization intent is flushed before any Keychain write; a store failure stops without retrying OS authorization."
  - "Selfcheck authority binds operation ID, maintenance generation and expiry; service, CLI, MCP and installer credentials remain distinct."
  - "Windows native execution and power-loss durability remain unverified; macOS tests cannot fill those cells."
requirements-completed: []
requirements-referenced: [SEC-01, PLAT-01]
duration: 11min
completed: 2026-08-27
---

# Phase 1 Plan 3: Native Platform Protection and Installation Identity Summary

**Protected macOS/Windows path adapters, real macOS Keychain canary verification, isolated 256-bit credentials and nonsecret recoverable installation identity.**

## Performance

- **Started:** approximately 2026-08-27 01:44 AEST
- **Completed:** 2026-08-27 01:55 AEST
- **Duration:** approximately 11 minutes
- **Tasks:** 2/2
- **Files:** eight implementation/test files plus this summary

## Accomplishments

- Detects actual OS version and architecture; supports the approved macOS 14+ arm64 / Windows 11 x64 targets and rejects unsupported combinations. No Rosetta, WSL or CPU-model inference is used.
- Separates program, runtime, browser, data, secrets, staging and future private Profile regions. Read-only preflight returns a root alias rather than a raw path. Tests create only harness-owned temporary roots; no persistent product installation or Profile was created.
- Rejects legacy overlap intrinsically, caller-added exclusions, path escapes, known synchronized directories, symlinks/junctions/reparse points, unsafe ownership, insecure ancestors, nonlocal volumes and unconfirmed locality. The macOS implementation checks the actual mount table. Windows checks native fixed NTFS drives; other volume types fail closed rather than being called verified local storage.
- Creates roots exclusively without adopting existing directories. macOS directories/files use 0700/0600 with ACL removal and actual mode/owner/ACL verification. Windows uses current SID, protected noninherited DACLs and SYSTEM/Administrators allowances; it does not substitute chmod for native ACLs.
- Implements the existing SecretStore port with exact `@napi-rs/keyring@1.3.0` AsyncEntry methods. The service namespace derives from an installation UUID; no credential search/enumeration occurs. Native failures expose only `SECRET_STORE_UNAVAILABLE`, without exception causes or plaintext fallback.
- Generates separate 256-bit random API, CLI, MCP and installer tokens inside product code. Verification checks current native storage, SHA-256 digest, scope and configured destination, so deletion and rotation invalidate previous authority. Temporary selfcheck credentials additionally bind operation ID, maintenance generation and expiry.
- Checks selected port 43187 by binding, without connecting to an unknown listener. Collision returns `PORT_CONFLICT_REPREVIEW` before creating a root or credentials.
- Writes strict nonsecret installation metadata only after successful credential provisioning, binding UUID/scope, port, token digests and root device/inode/UID. Reads reject ownership or destination tampering. A separate protected initialization intent precedes the first credential write so partial provisioning remains exactly identifiable without enumeration.

## Task Commits

1. **03-1 RED: native platform and path behavior** — `335e9c8`
2. **03-1 GREEN: native platform and isolated protected roots** — `9e492a3`
3. **03-2 RED: credential isolation and installation identity behavior** — `e6d4a36`
4. **03-2 GREEN: native credentials and recoverable installation identity** — `3d24c06`

Both RED runs failed because their implementation modules did not yet exist; those failures are not passing evidence. Both tasks then passed their actual behavior tests before GREEN commits.

## Verification Evidence

| Check | Evidence/platform | Result |
|---|---|---|
| Plan platform command through managed runtime wrapper | N, macOS 26.5.2 arm64, Node 24.20.0 | 6/6 pass |
| Plan native secret-store command through managed wrapper | N, actual macOS Keychain, keyring 1.3.0 | 1/1 pass; fresh canary set/read, second namespace absent, delete, absence confirmed |
| Plan credential-redaction command through managed wrapper | S with owned temporary filesystem integration | 7/7 pass at that run; final extension 8/8 pass under the same verified absolute Node |
| Final native suite through managed wrapper | N, macOS only | 7/7 pass, two files |
| Final unit plus integration regression | S/I, verified managed Node 24.20.0 | 34 unit + 20 integration = 54/54 pass |
| TypeScript check | Automated compiler check | pass |
| Build | Automated build check | pass; accurately reports zero actual app entries pending later plans |
| Independent orchestrator regression against `3d24c06` | S/I/N, same native macOS target | 61/61 pass and typecheck pass; separately executed canary cleaned |
| Native Windows 11 x64 / DACL / Credential Manager | N | not_run |
| Actual locked/denied OS Keychain or authorization prompt | N/manual | not_run; no prompt or auth error observed during canary runs |
| Simulated locked/unavailable native entry methods | S | get/set/delete fail closed with redacted errors; no plaintext fallback |
| School login, Profile reuse/reopen, real course data, live UAT | L | not_run; outside this plan |
| Power-loss recovery | N | not_run on both platforms |

Platform tests combine actual native positive operations with explicitly synthetic unsupported-platform/mount negatives; those negatives are not Windows or real-network-volume evidence. Credential tests never print canaries, pass secrets via argv/environment, or write secret values to files. Only fresh test namespaces are accessed. Real OS denial/locking must still be covered by the required human/native gates, not the injected-error tests.

## Downstream Contracts and Recovery Boundaries

- `createManagedRoot(selection)` and `initializeInstallation(selection, store)` require an exact installer-approved root/parent selection. They do not themselves obtain user approval. Plan 08 must present and bind the approval before invoking them outside approved test roots.
- System aliases are not generally exempted from link checks. Test harness paths are canonicalized before selection; a lexical symlink within a selected or managed path is rejected.
- `readInstallation(selection)` is the successful installation record, strictly validated against current protected root ownership. `readProvisioningReceipt(selection)` returns **historical initialization intent**, not current operation state.
- **Plans 08/09 must check for a valid `installation.json` first. Never revoke a successfully initialized installation merely because `provisioning.json` also exists.** If successful metadata is absent and the protected receipt is valid, recovery has the exact UUID and four permissible names for scope-bound retry/cleanup. No broad keyring search, inferred namespace or automatic retry through a locked/denied store is allowed. The higher-level installer recovery workflow remains owned by those plans.
- The intent file is fsynced before any credential write. On macOS, the parent directory is also fsynced. Windows currently flushes the file; directory-entry survival after power loss is **not verified**. The implemented receipt supports process-interruption recovery and must not be represented as a verified cross-platform power-loss transaction.
- Unknown existing roots are not silently adopted after failure. Subsequent installer recovery must explicitly reconcile the owned receipt/metadata and the approved operation. Failed creation may leave protected empty directories or exact-namespace credentials; the receipt is the recovery locator, not authorization to delete unrelated data.
- Windows native probes are implemented but unrun here. Their fixed-NTFS constraint and conservative ancestor/DACL checks may produce a visible stop on an unverified configuration; no downgrade is authorized. Native Windows testing remains required before Phase 1 acceptance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical recovery metadata] Preserve partial credential-provisioning identity**
- **Found during:** Task 03-2 independent review.
- **Issue:** Writing successful metadata only after four credentials could lose the UUID after an intermediate failure, leaving no safe way to identify residual entries.
- **Fix:** Persist a protected, flushed nonsecret initialization intent before the first write; expose a strict ownership-checked receipt reader. Stop immediately on store failure, preserving the human authorization gate.
- **Files:** `packages/platform/src/installation.ts`, `tests/unit/credential-redaction.test.ts`.
- **Verification:** A second-write denial leaves one synthetic credential, no successful metadata and a valid nonsecret receipt; exact recorded names allow cleanup without enumeration.
- **Commit:** `3d24c06`.

**Total deviations:** one necessary recovery-correctness addition. Review also tightened planned legacy exclusions, selfcheck generation binding and safe error propagation before their task commits. No dependency, architecture, permission or product-scope change.

## Documentation Lookup

Used installed exact keyring types and its [v1.3.0 API](https://github.com/Brooooooklyn/keyring-node/blob/v1.3.0/index.d.ts), official [Node 24 filesystem documentation](https://nodejs.org/docs/latest-v24.x/api/fs.html), Microsoft [DirectorySecurity](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.directorysecurity) and [reparse-point](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points) documentation. Context7 was unavailable; consistent with the approved research constraint, no additional documentation CLI/dependency was downloaded.

## Known Stubs

None preventing these two tasks. Null operation/generation/expiry in normal credential records explicitly means non-selfcheck authority; it is not an unwired placeholder. Installer approval/recovery orchestration, actual API authentication, client wiring and human/native Windows acceptance belong to the subsequent approved plans and are not claimed here.

## Threat Surface Review

All new file-access, ownership, local-volume and OS credential boundaries are covered by planned threats T-01-04/T-01-05. No new source/network endpoint, credential enumeration, real Profile, school access, release key, remote operation or legacy write was introduced. The only listener is a temporary bind-only selected-port availability probe.

## Issues and Human Gates

No authentication/human-action gate occurred. Native locked/denied-store and Windows checks remain unrun; phase-wide SEC-01/PLAT-01 therefore remain pending. No generated/private runtime artifacts were staged. Shared STATE/ROADMAP/PROJECT/REQUIREMENTS/VALIDATION updates remain the orchestrator's responsibility under the single-writer assignment.

## Next Plan Readiness

Plan 01-04 can consume the SecretStore and credential-verification contracts for the approved local API boundary. This does not authorize Phase 2 or waive Plan 12/14 and necessary OS human gates.

## Self-Check: PASSED

Verified all eight implementation/test files exist and all four task hashes resolve to commit objects. Final native tests, unit/integration regression, typecheck, build and `git diff --check` passed as reported. Task commits deleted no tracked files. No generated untracked runtime files remain; only this intentional summary was pending before its metadata commit.
