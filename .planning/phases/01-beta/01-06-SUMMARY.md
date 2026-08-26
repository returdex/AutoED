---
phase: 01-beta
plan: "06"
subsystem: actual-cli-mcp-selfcheck
tags: [stdio, official-sdk, authenticated-http, native-keyring, build-identity, selfcheck]
requires:
  - phase: 01-05
    provides: Independent API/Worker, native ownership checks and operation-bound execution
  - phase: 01-07
    provides: Actual status assets, paired read-only UI and shared presentation
provides:
  - Actual compiled CLI and official SDK stdio MCP using the authenticated local API
  - Operation-scoped temporary keyring credentials with exact protected recovery receipts
  - Independently read build manifest plus actual API/Worker/CLI/MCP and functional evidence
  - Manifest-aware shared CLI/UI completion checks and explicit failed selfcheck projections
affects: [01-08, 01-09, 01-10, 01-14]
tech-stack:
  added: []
  patterns: [native-endpoint-ownership-before-bearer, direct-http-no-proxy, SDK-stdio, exact-operation-receipt, independent-five-identity-evidence]
key-files:
  created: [apps/cli/src/main.ts, apps/mcp/src/main.ts, packages/client/src/http.ts, packages/client/src/credentials.ts, packages/client/src/discovery.ts, packages/platform/src/client-endpoint.ts, packages/platform/src/selfcheck-credentials.ts, packages/application/src/identity.ts, packages/test-support/src/native-runtime.ts, scripts/install/selfcheck.mjs, tests/integration/cli.test.ts, tests/integration/client-wiring.test.ts, tests/integration/build-identity.test.ts]
  modified: [apps/api/src/main.ts, apps/api/src/security.ts, apps/status/src/main.ts, packages/application/src/status.ts, packages/application/src/policy.ts, packages/application/src/ports.ts, packages/domain/src/model.ts, packages/contracts/src/index.ts, packages/contracts/src/presentation.ts, packages/persistence/src/runtime-status.ts, packages/platform/src/processes.ts, packages/test-support/src/status-fixture.ts, tests/unit/import-boundaries.test.ts, tests/unit/presentation.test.ts, tests/ui/accessibility.spec.ts]
key-decisions:
  - "Every bearer request first verifies the protected service record, native process identity, executable and exact loopback listener owner; unknown ownership sends no request."
  - "The client challenge binds reports to the recorded process but uses the already-sent bearer key; native ownership remains the security boundary."
  - "Installation metadata keeps exactly four fixed credential records; temporary operation credentials use exact protected nonsecret receipts and OS keyring values."
  - "build_manifest records an actual artifact read and hash, not release signature verification; Plan 08 supplies trust verification."
  - "Fresh spawned CLI/MCP probes do not prove an existing Codex host connection reloaded; later host acceptance remains mandatory."
requirements-completed: []
requirements-referenced: [ARCH-02, DIST-01, SEC-01]
duration: approximately 32min
completed: 2026-08-27
---

# Phase 1 Plan 6: Actual CLI/MCP Wiring and Independent Selfcheck Summary

**Compiled CLI and official SDK stdio tools execute through the authenticated API and SQLite Worker; independent manifest and four component observations must agree with actual echo/digest results.**

## Performance

- Execution and independent verification approximately 2026-08-27 02:53–03:25 AEST; 2/2 implementation tasks.
- Native execution: macOS 26.5.2 arm64, managed Node 24.20.0 / npm 11.19.0.
- No dependencies installed, release version bumped, tag created, remote accessed, school contacted or persistent product installation selected.
- Shared planning files remain owned by the root orchestrator. No phase-wide requirement completion is claimed.

## Accomplishments

- CLI implements `start`, `stop`, `status`, `selftest --kind echo|digest --value TEXT`, `jobs get|cancel UUID`, `pair approve CODE`, and `open-status`. Start/stop use the existing owned process supervisor; pending launch intent prevents a false successful stop. Status and jobs do not autostart anything. Pairing requires the user to enter the exact displayed correlation code on the terminal. The tests supply synthetic stdin; this is not human approval or user UAT. `open-status` opens only the fixed token-free loopback URL and was not invoked during automation.
- Shared HTTP uses direct `node:http` requests with `agent:false`, exact loopback host/port, bounded JSON responses and a total five-second abort deadline. It never uses ambient proxy settings or follows redirects. Each request checks protected service metadata, exact PID/OS creation/canonical executable/entry identity and native socket ownership before retrieving and sending its own credential, then checks ownership again after the asynchronous keyring read. Wrong installation, altered ownership and redirect/proxy cases fail closed.
- `/api/client/identity` is a fixed authenticated, scoped status endpoint. Its key comes from the actual authenticated credential record, and its installation ID comes from service metadata, not client scope echo. Challenge, actual build and recorded nonce are bound by HMAC; private PID, paths and nonce are not returned to MCP. This HMAC uses the bearer already sent to that listener, so it is a consistency check, **not** an independent server-secret proof or replacement for native endpoint ownership. The existing supervisor control proof using the unsent API key is unchanged.
- Official `@modelcontextprotocol/server` and `client` 2.0.0 perform stdio negotiation/framing. Exactly three strict tools are registered: `autoed_status`, `autoed_selftest`, `autoed_job_get`. URL, JavaScript, selector, path and root arguments are rejected. Root selection is only trusted launcher configuration. MCP imports the shared client and its narrow adapters, not filesystem, database, Profile or process drivers; transitive boundary tests continue to enforce this. Stdout is SDK protocol only; errors expose bounded public codes and component observations.
- Standalone API dynamically admits only the current exclusive operation's short-lived credential. Fixed `installation.json` still has exactly four records. Installer-only issuance binds operation UUID, generation and expiration, checks maintenance state before and after OS work, and binds issue generation to the API's immutable runtime generation. The credential is usable for model-destination scoped status/job/selfcheck operations, not management. CLI and MCP receive only a nonsecret `selfcheck-UUID` identifier and obtain the value in memory from the keyring.
- A deterministic protected `runtime/selfcheck-UUID.json` receipt contains installation/operation/generation, state and credential digest, never the token. A flushed issuing intent precedes OS creation. Repeat active issuance is idempotent; concurrent/conflicting work is rejected, not silently rotated. Revocation marks the receipt unusable before exact OS deletion; a failed delete retains the precise revoking receipt. Generation change after OS issuance revokes that exact key. No namespace enumeration or fallback plaintext credential store exists. A corrupt temporary receipt does not block already-matched fixed installer/CLI credentials and their recovery controls.
- Installer selfcheck reads and hashes the bounded actual build manifest file, launches the actual absolute CLI entry, and uses the official SDK to spawn the actual MCP entry. It collects independent API, Worker, CLI and MCP observations; all identity fields and capability sets must match, and observed echo/digest behavior must match the variant. A performs echo and explicitly fails digest with `UNSUPPORTED_CAPABILITY`; B computes the known SHA-256 of `abc`. No HTTP 200 or version-string-only success is accepted.
- Selfcheck records manifest, actual probes, feature result and the same job ID through the existing installer projection route. Early CLI/SDK/feature failures write an explicit failed projection when the API remains usable; missing probes remain absent instead of being filled with the target. If publication is unavailable, the returned result says `projectionWritten:false` with a sanitized code for the downstream installer journal. Cleanup errors are separate from the original failure, set `recoveryNeeded`, retain exact operation recovery identifiers and cannot return a successful result. The caller must stop for recovery rather than ignore these fields.
- Status now includes actual server installation ID and an optional independently observed manifest. Legacy projections without manifest remain unknown. The UI displays the actual build, hash, observation time and `build_manifest` evidence, explicitly distinguishing it from signature verification. Shared presentation requires matching manifest plus all four historical component probes, actual functional job evidence and completed cleanup before showing installation complete. Missing/wrong manifest cannot pass; historical completion still does not expire merely because a heartbeat becomes stale.

## Task Commits and TDD

| Task | RED | GREEN |
|---|---|---|
| 06-1: actual CLI/shared HTTP | `37dec8b` | `8923cd3` |
| 06-2: official stdio and five-identity selfcheck | `f266a6d` | `29a958e` |

- Task 1 RED failed at `CLI_ENTRY_MISSING` before native credential initialization. Task 2 RED failed compilation/import of the missing identity/MCP/selfcheck implementation, also before creating native credentials. These are recorded RED gates, not successful behavior evidence.
- During GREEN, TypeScript caught an overly narrow inferred UUID default parameter type; the shared client parameter was explicitly typed as a validated string. Local official SDK 2.0.0 types showed `callTool(params, options)` takes two arguments; the timeout was corrected before the first actual selfcheck run. No third-argument timeout claim is made.
- No native test failure required preserving an installation in this plan, and no OS permission prompt occurred. All fresh synthetic installation credentials and owned services were cleaned using exact identities after confirmed process exit. Existing Plan 05 recovery evidence remains in its own summary.

## Verification

| Evidence | Result |
|---|---|
| Targeted actual CLI tests | 2/2 passed |
| Pure identity/registry and shared presentation | 8/8 passed |
| Actual A/B CLI + SDK stdio + API + SQLite Worker wiring and negative cases | 8/8 passed, 41.86s targeted run |
| Full unit/integration/macOS native suite | 108/108 passed: 43 unit, 56 integration, 9 native; 77.89s |
| Actual Chromium UI | 10/10 passed, 3.6s; existing case extended with missing/wrong/correct manifest observations |
| TypeScript `tsc --noEmit` | Passed |
| Production build | Passed; four actual API/Worker/CLI/MCP entries plus status assets |
| Build identity before GREEN commit | `db533ec1df6bfcdae70f1a4274d948b5c9b6b2cbcaa677ff4bba105f781d3919` |
| Root independent verification of `29a958e` | 108/108 (43 unit + 56 integration + 9 macOS native), 76.43s; UI 10/10, 3.5s; typecheck and build exit 0 |
| Independent production build identity | `cbdc255872326530917a5f4393f9ceb2d6d69c7c9c1d3c8bf4671815058bde3a`, four actual entries |
| Native Windows / actual Codex-host reload / user manual UAT | Not run; not replaced by fixtures or macOS evidence |

The A/B integration fixtures really compile the current sources, include actual status assets and spawn independent processes using the managed Node. They inject explicit synthetic A/B identity constants into their isolated outputs and link only the currently approved dependencies; they are not signed release artifacts or final packaging-pipeline acceptance. Production `npm run build` is verified separately. Screenshots, trace, video and network capture remain off. Browser tests use the existing isolated repository browser cache and only synthetic local HTTP.

## Deviations from Plan

All support extensions were narrowly approved by the root orchestrator before use.

1. **[Rule 2 — secure actual endpoint connection]** Added client credential/discovery adapters and native endpoint proof integration, with the single approved transitive boundary edge and negative tests. Exported the existing strict process-record schema without widening process control. These were necessary before a real CLI/MCP could send a bearer safely.
2. **[Rule 2 — real maintenance selfcheck authentication]** Added the protected temporary registry, lazy actual-record authentication and installer-only issue/revoke endpoint. The previous fixed-array API factory was insufficient for standalone operation-scoped credentials. No arbitrary credential record or secret field was added to installation metadata.
3. **[Rule 2 — independent manifest and installation evidence]** Extended domain/contracts/status port/SQLite JSON projection/application policy/API/UI and presentation tests. This closes the explicit Plan 07 manifest gap; it does not claim Plan 08 release trust or Plan 10 platform diagnostics.
4. **[Rule 3 — real native fixture support]** Added a bounded isolated compiled runtime fixture. It preserves receipts on uncertain startup/native failure, waits for CLI stdio close without treating it as exit proof, proves service ownership before shutdown and deletes only exact fresh synthetic keyring entries after all owned processes exit.
5. **[Rule 1 — recovery and truthful completion]** Pending launch prevents CLI stop success; total HTTP deadlines prevent endless trickle responses; failed probes and credential cleanup cannot silently leave a successful selfcheck result. Bad temporary receipts cannot disable fixed control credentials. Parent review prompted these in-scope corrections.

## Threat Flags

| Flag | Files | Approved surface and mitigation |
|---|---|---|
| threat_flag: authenticated identity endpoint | API main/security, platform/client-endpoint | Fixed challenge only, actual authenticated record and installation, native ownership before bearer; no new public control port |
| threat_flag: temporary credential lifecycle | API main, platform/selfcheck-credentials | Installer-only, operation/generation/expiration fenced, OS keyring secret, exact protected nonsecret recovery receipt |
| threat_flag: manifest projection boundary | Contracts, policy, persistence, status UI | Strict bounded identity/hash/time/evidence, installer-only write, old absence unknown; build observation is not signature trust |

## Known Stubs and Downstream Requirements

- No blocking placeholder remains for this plan's actual CLI/MCP/selfcheck chain. Empty/missing probes on failure are deliberate unknown evidence, not target-filled stubs.
- Plan 08 must verify release signatures and trust before a build observation can be treated as verified release evidence. Plans 08/09 must obtain `verified_release_manifest` from the actual verifier, never merely upgrade the evidence string. This plan creates no release key or trust root.
- Manifest path/read/JSON/schema preflight happens before the selfcheck's execution `try` block. Such failures are rejected before credential issuance and cannot write a new API projection; Plan 09 must journal that failure and invalidate any pending operation's inherited success instead of reusing the previous completion state.
- Plan 09 must journal offline/unwritten failures and honor `recoveryNeeded`/exact receipts. After exiting maintenance and advancing generation, it must start normal API/Worker at the new generation and verify again; candidate selfcheck processes cannot simply be retained as successful normal service.
- Endpoint discovery binds the current compiled tree's fixed API entry. Controlling an older API during upgrade requires the verified old inventory's controlled entry/controller; do not turn MCP tools into arbitrary expected-entry selectors.
- A newly spawned MCP selfcheck process does not prove the currently connected long-lived Codex host has restarted/reloaded. Plans 09/10/14 must check the actual host version and treat an unresolved old client as incomplete overall upgrade acceptance.
- Plan 07 platform/CPU/dependency/SQLite/browser diagnostics remain explicitly unobserved pending Plan 10. `previousInstallation=none` still requires actual inventory evidence in Plan 09, never inference from null build values.
- Native Windows, true Codex exit persistence, release obtainability and actual user update/login UAT remain their later native/human gates. No school/login/Profile access or `open-status` invocation occurred here; automated Chromium used only the synthetic UI fixture.

## Authentication Gates

None encountered. Synthetic native keyring tests required no visible OS action. Future keyring denial/recovery or OS prompts remain hard human gates; no approval was synthesized.

## Self-Check: PASSED

- All 13 created implementation/test files listed above exist.
- RED/GREEN commits `37dec8b`, `8923cd3`, `f266a6d`, `29a958e` are present in Git.
- GREEN commit has no tracked deletions; no unrelated files were staged. Root's `624b44e` planning-only host-reload reminder was preserved.
- `git diff --check` passed. Local author identity remains the approved `returdex` identity; no global identity or remote authentication was changed.
- Own and root independent automated results are distinguished above. All test/build processes have finished. No unverified native Windows, actual host reload, release trust or human feedback cell is marked passed.
