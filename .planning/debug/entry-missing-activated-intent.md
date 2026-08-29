---
status: investigating
trigger: "Published 0.1.0-beta.1 first-install bootstrap exits with ENTRY_MISSING_ACTIVATED_INTENT after the user confirms the exact preview scope."
created: 2026-08-29T13:26:11Z
updated: 2026-08-30T00:10:00+10:00
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

## Eliminated

- hypothesis: Unsupported host platform or architecture.
  reason: Host is native Darwin arm64 and preview accepted the macOS 14+ platform gate.
- hypothesis: Bootstrap download corruption.
  reason: The downloaded bootstrap matched the published full SHA-256 exactly and the signed release assets reached verified staging.

## Resolution

- root_cause: Production packaging adds a `dist/` prefix that the installer runtime and generated launchers did not resolve; fixture archives omitted that packaging boundary. Windows launchers also omitted the packaged Node `bin/` segment.
- fix: Resolve one complete, non-symlink entry layout from the signed program manifest (`dist/` production or legacy fixture layout), bind launcher/runtime paths to that verified layout, use `bin/node.exe` on Windows, and make the A/B fixture reproduce the production wrapper.
- verification: Targeted regression first failed with the observed code, then typecheck, 21 affected integration tests, staging compatibility tests, the 4-test recovery suite, and seven release-gate tests passed. Full clean suite and published replacement beta verification remain pending.
- files_changed: packages/installer/src/launchers.ts; packages/installer/src/upgrade.ts; packages/test-support/src/upgrade-fixture.ts; scripts/build/assemble.mjs; scripts/release/materialize.mjs; scripts/release/preflight.mjs; scripts/release/publish.mjs; tests/integration/release-gates.test.ts
