---
status: investigating
trigger: "Published 0.1.0-beta.1 first-install bootstrap exits with ENTRY_MISSING_ACTIVATED_INTENT after the user confirms the exact preview scope."
created: 2026-08-29T13:26:11Z
updated: 2026-08-30T22:18:00+10:00
---

# Debug Session: ENTRY_MISSING_ACTIVATED_INTENT

## Symptoms

- Expected behavior: The verified macOS arm64 beta.1 bootstrap completes first installation in `/Users/yifeng/Library/Application Support/AutoED-Rebuild-M1`, after the user confirms the preview scope.
- Actual behavior: The installer downloads and stages the signed release but exits during activation with `ENTRY_MISSING_ACTIVATED_INTENT`.
- Error messages: `ENTRY_MISSING_ACTIVATED_INTENT`; bootstrap reports the verified installer's preview command exited with status 1.
- Timeline: First observed on 2026-08-29 during the first real published beta.1 installation attempt.
- Reproduction: Run the published beta.1 bootstrap on native Apple Silicon macOS, select the approved root, and enter the exact scope-bound confirmation phrase.

## Current Focus

- hypothesis: Confirmed root cause: production artifacts prefix compiled entries with `dist/`, while launcher/runtime resolution accepted only fixture-style unprefixed entries; Windows additionally pointed at `runtime/24.20.0/node.exe` instead of the packaged `bin/node.exe`.
- test: Make the A/B upgrade fixture use the production `dist/` layout, prove the original code fails with the observed error, then run typecheck and the affected integration suites after the fix.
- expecting: Production-layout first install and A-to-B upgrade complete through actual CLI/MCP/API/Worker paths without weakening manifest inventory checks.
- next_action: Run the full automated suite from a clean fixed-port state, commit the tested repair, build and anonymously verify immutable beta.3/beta.4 replacements under the isolated `returdex` identity, then retry installation through the documented human confirmation gate.
- reasoning_checkpoint: Installation remains failed; no MCP registration, selftest, course login, cleanup, or broad deletion is authorized.
- tdd_checkpoint: Not started.

## Evidence

- timestamp: 2026-08-29T13:26:11Z
  observation: Public availability verification passed for beta.1 and beta.2 before installation.
- timestamp: 2026-08-29T13:26:11Z
  observation: The selected root was absent before the attempt; the failed attempt left a staged program/runtime/browser, SQLite data, installation/provisioning receipts, an operation journal, snapshot, activation directory, failure receipt, and update lock; no matching process remains.
- timestamp: 2026-08-29T13:30:00Z
  observation: The signed beta.1 manifest and extracted tree contain `dist/apps/{api,worker,cli,mcp}/src/main.js`, while the installer searched for `apps/{api,worker,cli,mcp}/src/main.js`; the failure receipt records `ENTRY_MISSING_ACTIVATED_INTENT` and the last durable journal entry is `activated/intent`.
- timestamp: 2026-08-29T13:31:00Z
  observation: After changing the integration fixture to the production `dist/` layout, the existing A-to-B test failed with the same `ENTRY_MISSING_ACTIVATED_INTENT` code.
- timestamp: 2026-08-29T13:36:00Z
  observation: After resolving exactly one verified entry layout and correcting the Windows managed Node path, typecheck and 21 affected integration tests passed, including production-layout first install, A-to-B upgrade, journal recovery, and CLI/MCP wiring.
- timestamp: 2026-08-30T00:03:00+10:00
  observation: The first full rerun exposed a fixture-only compatibility regression, fixed by separating launcher layout detection from full runtime-entry enforcement; the two affected staging tests and production A-to-B test then passed.
- timestamp: 2026-08-30T00:04:00+10:00
  observation: A subsequent full rerun exposed a pre-existing silent cleanup return in the recovery fixture. One exact synthetic API/Worker pair remained on port 43187 and caused 29 cascading failures. Their installation ID, executable, entrypoint, PID and OS start identities all matched owned test receipts.
- timestamp: 2026-08-30T00:10:00+10:00
  observation: The exact owned processes were stopped through `OwnedProcessSupervisor`; five exact synthetic Keychain slots were removed; the temporary root was moved to Trash. Silent cleanup suppression was removed. The 4-test recovery suite passed in 370.83s and left port 43187 clear.
- timestamp: 2026-08-30T00:10:00+10:00
  observation: Release tooling now accepts a validated next consecutive A/B pair, refuses existing version directories, preserves prior publication receipts, and derives prompts from the pair. Typecheck and the seven release-gate tests pass.
- timestamp: 2026-08-30T00:41:00+10:00
  observation: One full-suite attempt recorded a fail-closed `LOCAL_VOLUME_UNCONFIRMED` while stopping the synthetic Worker. The exact lifecycle test then passed alone, repeated mount-table probes returned immediately, no matching process or fixed-port listener remained, and an unchanged full integration rerun passed all 112 tests in 842.13 seconds. The transient query failure did not recur, so local-volume validation was not cached or weakened.
- timestamp: 2026-08-30T00:42:00+10:00
  observation: Final local gates passed: typecheck, 43 unit tests, 112 integration tests, 12 native macOS tests, 10 Playwright UI tests, and the production build. Port 43187 was clear and no matching synthetic service process remained after integration cleanup.
- timestamp: 2026-08-30T00:48:00+10:00
  observation: Immutable replacement releases 0.1.0-beta.3 and 0.1.0-beta.4 were published under the isolated `returdex` identity with 18 assets each. Anonymous full-download verification passed for all 36 assets, including length, SHA-256, signature, exact archive closure and build identity. Windows native and human UAT remain `not_run`.
- timestamp: 2026-08-30T00:55:00+10:00
  observation: Retried beta.3 against the preserved first-install root with the same confirmed scope. The installer safely refused the partial initialization state (valid initialization/provisioning receipts and journal at `activated/intent`, but no `active.json`), leaving the root unchanged; first-install recovery is explicitly manual (`automaticRetry:false`). A fresh root is required for a new install attempt unless the user performs the documented human recovery.
- timestamp: 2026-08-30T03:32:00+10:00
  observation: A clean beta.3 first install after explicit residual cleanup reached `download_verified` and failed closed with `ENTRY_MISSING_DOWNLOAD_VERIFIED_INTENT`. The signed production manifest required `dist/build/identity.json`, but the assembler had omitted the repository build identity from the packaged `dist` tree. The partial root, credentials and journal were preserved; no service listened on 43187.
- timestamp: 2026-08-30T03:32:00+10:00
  observation: The assembler now copies a trusted identity from the compiled fixture when present, otherwise from the project build output, into `program/dist/build/identity.json`. The production packaging regression passed, including the real A/B closure diagnostic; beta.5/beta.6 publication remains pending full gates.
- timestamp: 2026-08-30T03:55:00+10:00
  observation: Final gates passed after the identity packaging fix: typecheck, 43 unit tests, 112 integration tests, 12 native macOS tests, 10 Playwright UI tests and production build. Immutable beta.5/beta.6 were published with 18 assets each; anonymous full-download verification passed for all 36 assets. Windows native and human UAT remain `not_run`.
- timestamp: 2026-08-30T21:49:00+10:00
  observation: A direct beta.5 first install reached activation but failed at `started` with `SERVICE_START_FAILED_STARTED_INTENT`. The exact managed Node binary existed with the expected SHA-256 but mode `0600`; both CLI invocations returned `Permission denied` and no service listener was present.
- timestamp: 2026-08-30T21:51:00+10:00
  observation: Applying `chmod 700` only to that managed Node path allowed the API and Worker to start and pass authenticated status. This diagnostic workaround was not treated as installation completion; the install projection remains failed/stopped and the database remains in the installer-owned exclusive gate.
- timestamp: 2026-08-30T21:53:00+10:00
  observation: Root cause is confirmed in the build-to-archive boundary: `inventoryTree` omitted executable metadata, while the verified extractor intentionally creates files as `0600` and only restores `f.executable`. The source fix records executable bits and adds a darwin/windows artifact-assembly regression assertion; typecheck, all 43 unit tests and the affected 5 integration tests pass under the managed Node 24.20.0 toolchain.
- timestamp: 2026-08-30T22:17:00+10:00
  observation: Full repaired gates passed: 112 integration, 12 native macOS, 10 UI, typecheck, 43 unit and production build. Immutable beta.7/beta.8 were published without overwriting beta.1–6; anonymous verification passed all 36 new assets, including byte length, SHA-256, signatures and exact archive closures.

## Eliminated

- hypothesis: Unsupported host platform or architecture.
  reason: Host is native Darwin arm64 and preview accepted the macOS 14+ platform gate.
- hypothesis: Bootstrap download corruption.
  reason: The downloaded bootstrap matched the published full SHA-256 exactly and the signed release assets reached verified staging.

## Resolution

- root_cause: Production packaging adds a `dist/` prefix that the installer runtime and generated launchers did not resolve; fixture archives omitted that packaging boundary. Windows launchers also omitted the packaged Node `bin/` segment. The production assembler additionally omitted the required `dist/build/identity.json` file. Finally, executable mode metadata was omitted from release inventories, so verified extraction left the managed Node runtime non-executable.
- fix: Resolve one complete, non-symlink entry layout from the signed program manifest (`dist/` production or legacy fixture layout), bind launcher/runtime paths to that verified layout, use `bin/node.exe` on Windows, make the A/B fixture reproduce the production wrapper, package the trusted build identity into `dist/build/identity.json`, and preserve executable bits in the signed inventory so extraction restores them.
- verification: The mode regression and all repaired gates pass under the managed Node 24.20.0 toolchain: typecheck, 43 unit tests, 112 integration tests, 12 native macOS tests, 10 Playwright UI tests and production build. Anonymous full-download verification passes all 36 immutable beta.7/beta.8 assets. Beta.5 remains a failed diagnostic attempt; it is not treated as an install result.
- files_changed: packages/installer/src/launchers.ts; packages/installer/src/upgrade.ts; packages/test-support/src/upgrade-fixture.ts; scripts/build/assemble.mjs; scripts/build/native-artifacts.mjs; scripts/release/materialize.mjs; scripts/release/preflight.mjs; scripts/release/publish.mjs; tests/integration/artifact-assembly.test.ts; tests/integration/release-gates.test.ts; tests/integration/two-build-upgrade.test.ts
