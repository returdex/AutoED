---
phase: 01-beta
plan: "08"
subsystem: verified-bootstrap-and-install-preview
tags: [ed25519, manifest, bootstrap, archive-closure, native-launcher, scope-confirmation]
requires:
  - phase: 01-03
    provides: Protected local roots, installation metadata, exact credential namespaces and native permissions
  - phase: 01-06
    provides: Actual CLI/MCP, independent manifest observations and authenticated runtime clients
  - phase: 01-07
    provides: Shared truthful installation presentation
provides:
  - Exact-byte Ed25519 verification, strict release schema and complete artifact/file closure checks
  - Bounded no-Node bootstrap templates with independent Node/core trust before installer execution
  - Explicit same-process scope confirmation, stable installation ID and immutable initial staging
  - Private verified CLI/MCP launchers and registration previews without host/PATH/autostart changes
affects: [01-09, 01-10, 01-11, 01-12, 01-13, 01-14]
tech-stack:
  added: []
  patterns: [exact-byte-signatures, branded-verified-manifest, shared-node-only-archive-core, no-replace-active-publication, scope-bound-confirmation]
key-files:
  created: [packages/installer/src/verify-manifest.ts, packages/installer/src/archive-core.ts, packages/installer/src/download.ts, packages/installer/src/preview.ts, packages/installer/src/install.ts, packages/installer/src/launchers.ts, scripts/build/synthetic-sign.mjs, scripts/install/bootstrap.sh, scripts/install/bootstrap.ps1, tests/integration/manifest-verification.test.ts, tests/integration/bootstrap.test.ts, tests/integration/install-preview.test.ts, docs/INSTALL.md]
  modified: [packages/platform/src/installation.ts]
key-decisions:
  - "Production trust remains unestablished until the Plan 12 human gate; test-selected public keys never become release trust."
  - "Bootstrap embeds independently hash-pinned actual compiled archive-core and permissions modules; downloaded installer code cannot verify itself."
  - "At most 256 declared darwin browser links with safe descending relative targets are accepted; validate the complete link graph and write regular files before links."
  - "Initial confirmation binds the real installation UUID, manifest hash, paths, permissions and selected-root inventory; existing active installations require the Plan 09 upgrade engine."
  - "Staged bytes and private entrypoints are not installation completion, runtime health, user UAT or a reloaded Codex MCP host."
requirements-completed: []
requirements-referenced: [DIST-02, PLAT-01, SEC-01]
duration: approximately 55min
completed: 2026-08-27
---

# Phase 1 Plan 8: Verified Bootstrap, Scope Confirmation and Private Launchers

**Exact-byte signatures and closed archive verification precede installer execution; a real interactive installer binds confirmation to the actual installation ID and publishes independently verified private entrypoints.**

## Performance

- Implementation and own verification: approximately 2026-08-27 03:24–04:18 AEST; 3/3 tasks, including final link-graph complexity bound.
- Platform: macOS 26.5.2 arm64, approved Node 24.20.0 / npm 11.19.0. No new dependency, release version, tag, remote or actual release key was created.
- 13 implementation/test/documentation files created; one approved narrow platform file extension. Root-owned planning/config files were not edited or staged by this executor.
- No school, Profile, legacy runtime, unrelated installation or user secret was read. No persistent default product installation was selected. All new installation fixtures used explicitly owned temporary roots; Plan 08 installer tests used synthetic in-memory credentials, not native authorization claims.

## Accomplishments

### 08-1 — Manifest trust and complete file closure

- Actual `node:crypto` Ed25519 verification uses the exact bounded manifest bytes, not reserialized JSON. Public key type and SHA-256 SPKI fingerprint are checked. Strict schema validates target, build/tree/dependency identity, protocol/schema, fixed dependency versions, artifact hashes/sizes, complete per-file closure, dependency provenance and test states. Incompatible target/schema/protocol, tampered bytes, wrong key, downgrade, malformed file sets and hash mismatches reject.
- `VerifiedManifest` is immutable and branded only inside the verifier. JSON copies cannot authorize artifact extraction. Synthetic verification is explicitly `synthetic_signature`; it never becomes `verified_release_manifest`. Production `verifyRelease` currently stops with `RELEASE_TRUST_NOT_ESTABLISHED`, as required until the actual Plan 12 trust decision.
- Synthetic signing generates an Ed25519 pair in a short-lived isolated managed-Node process. Only the public key/fingerprint and signatures return; the private key is never exported to parent memory, files, environment or output. The signing child closes before a fixture is returned. This is test-key lifecycle evidence, not actual release-key custody.
- File verification enumerates the owned root without following links and requires the exact listed closure. Extra files, unexpected directories, nested unlisted links, duplicate/case-colliding paths, a file used as an ancestor, size/hash differences and hard-linked regular files reject. Internal spaces in the actual headed Chrome application path are supported; traversal, Windows reserved names, trailing dots/spaces, controls and separator injection are denied.

### 08-2 — Bounded bootstrap and archive handling

- macOS shell and Windows PowerShell templates first reject unestablished production trust. Once trusted constants are supplied by an approved build, they check OS/CPU, an existing canonical local staging parent, safe ancestors/permissions, literal legacy exclusions and disk capacity before creating a private temporary stage. They do not modify global Node, PATH, execution policy, host configuration or startup settings.
- The fixed official Node archive hash was independently verified in Plan 01. Bootstrap downloads only that version, verifies the archive hash, and extracts only the regular Node executable, not npm/corepack links. Only then can it execute the separately hash-pinned bootstrap payload. `NODE_OPTIONS`/`NODE_PATH` and ambient Node injection settings are not inherited by the macOS verified-Node execution; Windows uses an explicit minimal process environment with required OS values.
- The payload contains this repository's actual compiled `archive-core` and `permissions` modules. Both have only `node:*` runtime imports. Payload and module hashes bind their bytes; generation tests compare the module hashes with the actual compiled sources. The trusted core verifies manifest signature/compatibility and installer archive/file closure before executing the installer entry. There is no downloaded-verifier trust cycle and no production `--trust-key`, arbitrary-module path or skip-verification CLI option.
- All runtime downloads use direct HTTPS, approved host/path rules, every-hop DNS/public IPv4 checks and an explicitly pinned IPv4 lookup. Redirect and error response bodies are destroyed by the Node transport. Archive downloads stream to exclusively created protected files with exact byte/hash checks and fsync; a failed partial file is removed only if its own recorded device/inode still matches. Metadata reads are bounded in memory. Shell/PowerShell curl disables curlrc, globbing and proxies and requires curl >=8.4.0 because older versions do not enforce the unknown-length transfer limit. There is no automatic curl installation or fallback.
- One shared strict parser/extractor serves bootstrap and installer: bounded USTAR/gzip and ZIP, CRC/local-central consistency checks, fatal full UTF-8 ZIP names, path/type/count/size/hash closure checks before writes, then protected regular-file writes and final rereads. USTAR decoded data is limited to 512 MiB and rejected by the signed schema before download when larger; ZIP is the browser packaging path. Unsupported archive formats/features fail closed.
- macOS browser manifests may explicitly declare safe relative links. Link target bytes/hash and the complete link graph must agree; no dot/dotdot, escape, cycle, dangling link, file write through an alias or unlisted link is accepted. Windows links are rejected. Regular files are verified and written before any link. The five actual headed Chrome Framework link relationships, including `Versions/Current`, were reproduced in a bounded synthetic ZIP and really extracted/resolved; no headed browser or school session was launched.

### 08-3 — Actual confirmation and stable private entrypoints

- Preview binds the actual selected-root inventory, installation ID, manifest hash, target/current record, OS/CPU, exact program/runtime/browser/data/staging/bin paths, dependency versions and per-artifact bytes, permissions, process-impact uncertainty, downtime, retention and recovery status. It explicitly says no autostart and no host configuration change. Existing null/missing build evidence is not treated as proof that no installation exists.
- The actual compiled installer CLI performs preview and terminal confirmation in the same process. Only `INSTALL <full scopeHash>` accepts that exact preview. Refusal, a forged confirmation, changed permissions or an invalid installation UUID cause no managed-root or credential changes. The preview's UUID is passed to `initializeInstallation` and matches real metadata and all four credential scopes. The optional UUID extension validates before root/key side effects; existing callers keep the previous default behavior.
- In-memory confirmation brands are not persisted approval tokens. A restart must re-read actual protected files and rebuild/reconfirm the scope through the recovery workflow. A protected approved-preview receipt and the existing initialization intent preserve exact recovery identifiers; no broad key enumeration/deletion is used. Valid installation metadata takes precedence over its historical provisioning intent.
- Initial confirmed staging verifies all archive bytes, creates immutable `program/<buildId>`, `runtime/24.20.0` and `browser/1234`, retains `data`, and publishes protected active/entry ownership records. New records use atomic no-replace publication, never a rename over an unknown competing entry. Repeating the same confirmed operation verifies the existing files/entry receipts and does not issue new credentials or delete retained data. A different scope over an existing active installation returns `UPGRADE_ENGINE_REQUIRED`; no active upgrade bypass is provided.
- The private macOS launcher checks the fixed Node and resolver hashes before executing Node with a minimal environment. Its resolver validates the exact active bytes, installation ownership/ID, schema/protocol and the complete program file closure, then imports the selected actual entry in the same Node process. Space/Chinese/percent/exclamation paths were exercised. Changed active or program bytes and an unknown replacement launcher cannot silently execute or be adopted.
- Windows retains a `.cmd` for manual CLI use. Generic MCP registration instead points to a fixed native PowerShell executable with a static encoded protocol: root paths are base64 data, role is fixed to MCP, Node/resolver hashes are checked, a cleaned `ProcessStartInfo` environment is used, and raw stdio handles are inherited without a PowerShell text pipeline. This is only a registration preview, not a host write. Windows native execution remains unverified.
- `docs/INSTALL.md` supplies full macOS/Windows installation and upgrade prompts, actual safety/confirmation behavior and explicit pending publication values. Shared presentation reports `staged`/in-progress and the remaining startup/selfcheck/cleanup steps, never a fabricated percentage or completed installation.

## Commits and TDD Gate Compliance

| Task | RED | GREEN / follow-up |
|---|---|---|
| 08-1: exact signatures and closure | `6af63c0` | `fa8bb46` |
| 08-2: bounded bootstrap and archives | `6b292d6` | `f8db1e6`, contract/shell correction `b8e35ec` |
| 08-3: confirmation and launchers | `2a6c7e9` | `c1854d8` |
| Security closure: bounded signed link graph | `71b46e0` | `78e8220` |

All three RED commits precede their implementations. Initial RED runs failed at the missing implementation import, before native key/root operations; they are not passing behavior evidence. Later security regressions were added alongside the corresponding implementation/review fixes and are not falsely described as separate prior RED gates. GREEN commits contain no tracked deletions. Root's independent planning-only commits `92d298e` and `8007131` were preserved.

## Verification

| Evidence | Actual result |
|---|---|
| Exact manifest/signature/file closure | 3/3 passed |
| Bootstrap/download/archive tests | 9/9 passed |
| Confirmation/staging/launcher tests | 4/4 passed |
| Full unit/integration/macOS native suite | 124/124: 43 unit + 72 integration + 9 macOS native; 96.50s |
| Existing Chromium UI | 10/10 passed; 3.8s; screenshots/trace/video remain off |
| TypeScript `tsc --noEmit` | Exit 0 |
| Production build | Exit 0; four actual API/Worker/CLI/MCP entries plus status assets |
| Own production build identity at `c1854d8` | `dc524aebc933637e62c340a730d8d1fd47a043b99437ad47da22de4c78d62555` |
| Root independent suite before final link cap, `c1854d8` | 124/124 passed; 108.24s |
| Final link-cap patch, `78e8220` | Targeted 16/16 passed; 14.84s; `tsc --noEmit` exit 0; diff check passed |
| Root independent final suite, `78e8220` | 124/124: 43 unit + 72 integration + 9 macOS native; 103.16s |
| Root independent final UI / typecheck / build | UI 10/10, 3.6s; `tsc --noEmit` exit 0; build exit 0, four entries plus status assets |
| Root independent final build identity | `b043038b35f4e0263b3eb9e09ced3caa7143b1811aa4ce483212f4e102063872` |
| Actual pinned native HTTPS | Official Node HEAD returned 200; actual compiled core read 3,171 bounded bytes from official `SHASUMS256.txt` and found the approved Node archive hash |
| Native Windows / actual user install / real Codex exit or host reload | Not run; no substitute evidence |

The shell chain really executes the fixed official cached Node archive in an owned temporary root with no Node on PATH. A trusted synthetic template replaces **only download transport** with owned local fixtures; signature, Node hash, embedded-core hash, extraction and installer execution remain real. Bad Node, modified embedded verifier bytes, bad signature and bad installer archive cause no installer execution; the append-only execution canary and `NODE_OPTIONS` canary verify this. This is not actual whole-release Internet download/install evidence. The separate official HTTPS probe above is only a bounded network check.

The installer CLI test compiles the real installer and uses trusted programmatic fixture-verifier/in-memory-credential/download adapters; no such overrides are CLI or model inputs. Private launcher tests use the actual managed Node, a synthetic CLI entry, and a synthetic server built with the approved official SDK. The actual SDK client negotiates/calls through the produced macOS registration and observes the owned process gone after close. These tests prove launch/protocol behavior, not actual release packaging, product selfcheck, native credential consent or user UAT. The existing full suite separately rechecks the real product CLI/MCP/API/SQLite Worker chain from Plan 06.

## Deviations and Issues

1. **[Rule 2 — shared trust boundary]** Added the narrowly approved `archive-core.ts` support file and embedded the already approved permissions module's compiled bytes. This prevents bootstrap and installer from drifting into separate weaker extraction/ACL implementations, without a new bundler or dependency. Bootstrap's minimal manifest precheck and the full Zod verifier remain distinct implementations of the same contract; compatibility tests cover their current Windows kernel-version behavior and revision lengths are aligned to 40/64 hex.
2. **[Rule 2 — genuine preview identity]** Extended only `initializeInstallation` with the approved optional UUID parameter. Previously its internal random ID would have invalidated a preconfirmed preview ID. Invalid IDs now reject before side effects, and actual metadata/credential scopes are tested.
3. **[Rule 2 — native packaging compatibility]** Explicit safe darwin-browser links and internal spaces were added after the root's read-only inspection of the official headed Chrome archive showed five Framework symlinks. The real target relationships are tested synthetically; Windows links remain denied. No arbitrary link normalization or codesign-breaking flattening is used.
4. **[Rule 3 — Windows builtin download path]** The approved Windows implementation uses fixed System32/curl.exe rather than assuming a pure-.NET download implementation, and ZipArchive selects only the independently hash-pinned Node executable rather than broadly expanding the archive. Tool availability/version, Windows native execution and OS behavior still require Plans 10/14.
5. **[Rule 1 — review corrections]** Full ZIP names no longer truncate at NUL, redirects close their bodies, USTAR limits are schema-visible, file-ancestor collisions avoid quadratic comparisons, unsafe link dotdot semantics are rejected, and Node 24 pinned DNS uses `family:4`. Parent independently demonstrated the missing-family lookup failure; the corrected actual native transport was verified against official Node content. Shell uses `bootstrap_home`, not a reserved HOME/home variable.
6. **[Rule 2 — real host launch protocol]** Windows registration uses an executable PowerShell protocol instead of assuming every host directly starts `.cmd`; macOS actual SDK negotiation is tested. Same-process resolver import avoids an extra blocking spawn wrapper. No host configuration was written.
7. **[Rule 2 — bounded graph validation]** Final review bounded explicit browser links to 256 in the shared graph validator used by both manifest validators and extraction. The actual signed 257-link counterexample first failed in RED (`71b46e0`), then rejected in GREEN (`78e8220`); 256 links and the five official Framework relationships remain accepted. This bounds graph-resolution work independently of the larger regular-file allowance.

No OS authorization prompt, release-key action or authentication gate occurred. No failed Plan 08 test left an owned native process or credential namespace pending recovery. Temporary roots are deleted only after their directly owned child exits; uncertain exit paths preserve the root and report human recovery rather than deleting authentication/control material. No new server endpoint or permission surface outside the plan's archive-to-execution and confirmation-to-filesystem trust boundaries was introduced.

## Known Intentional Gates and Downstream Requirements

- **Plans 11/12/13:** `verifyRelease` and bootstrap `UNESTABLISHED` constants are intentional fail-closed gates. Actual approved fixed release trust, generated embedded payload/hash, signed complete artifacts, publishable URLs and prompt values must be supplied by those plans. Do not rename `synthetic_signature` or ordinary `build_manifest` into `verified_release_manifest`; derive release evidence from the actual approved verifier and bytes. No published beta or obtainable artifact is claimed here.
- **Plan 09:** `staged` is not installed/updated successfully. Connect journal/backup/migration/activation/recovery, actual runtime startup, feature/five-identity selfcheck and obsolete managed cleanup. Existing active installations must use that engine. Preserve valid installation metadata over old provisioning intent; retain exact receipts on interruption/OS failure. Never delete archives as program cleanup.
- **Plan 09:** Fixed active hash, Node hash, resolver and launcher pins form one journal update set. A stable path does not mean old launcher contents can remain across an active build change. Immutable generation capture still requires fresh normal API/Worker after maintenance exit, followed by real verification.
- **Plans 09/10:** Bootstrap installer staging and `program/<build>` are different trees. Plan 06 endpoint discovery currently binds its own compiled API entry; use a verified target-program controller or an installer-internal trusted inventory/manifest binding, including first install. Do not add arbitrary expected-entry/root selectors to MCP tools. Test actual installation locations rather than a fixture where every component shares one tree.
- **Plans 09/10/14:** Resolver import changes Node's `process.argv`, not OS argv. OS inventory may show `bin/launcher.mjs`, so combine verified registration/launcher receipts with actual MCP build probes. A fresh spawned selfcheck does not establish that an existing Codex host reloaded. Unresolved old hosts remain incomplete/human-needed.
- **Plans 10/14:** Windows minVersion is the actual kernel floor `10.0.22000`; `10.0.26100` passes and Windows 10 `10.0.19045` fails both verifiers. Check actual builtin curl >=8.4, NTFS/ACLs, extraction, paths/arguments and registration natively. PowerShell parent exit does not prove its Node child exited: test actual EOF/host close and both owned processes. macOS/WSL results are not substitutes.
- **Plan 10:** Preserve the real headed browser Framework links and verify its actual signed executable/browser behavior. The Plan 08 synthetic browser file/link fixture is not a browser-provider or codesign acceptance test. Full archive/dependency assembly and final signed installer pipeline remain separate from these compiled fixture tests.
- No other blocking placeholder was found. Empty buffers/maps used while parsing/downloading and null/unknown current runtime observations represent real intermediate/unknown states; they are not fabricated completion data.

## Self-Check: PASSED

All 14 implementation/test/documentation paths exist. All nine listed RED/GREEN/follow-up commits exist in history, with no tracked deletions; diff check passed. The placeholder scan found only the documented production trust gates. Root independently passed the final post-cap full suite, UI, typecheck and build as recorded above. All test/build processes have ended. Shared planning updates remain owned by the root orchestrator.
