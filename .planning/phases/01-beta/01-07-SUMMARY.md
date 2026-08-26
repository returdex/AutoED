---
phase: 01-beta
plan: "07"
subsystem: read-only-status-ui
tags: [native-html, real-http, playwright, pairing, accessibility, truthful-status]
requires:
  - phase: 01-04
    provides: Authenticated API, pairing sessions, strict status projections
  - phase: 01-05
    provides: Independent API/Worker runtime and process observations
provides:
  - Compiled public status assets served by the actual API through a fixed whitelist
  - Read-only paired Chinese status page using actual authenticated HTTP
  - Shared pure feedback functions separating historical completion from current observation
  - Explicit optional previous-installation evidence, with absence remaining unknown
affects: [01-06, 01-08, 01-09, 01-10, 01-14]
tech-stack:
  added: []
  patterns: [native-HTML-CSS-TypeScript, textContent-only rendering, same-origin pairing, scoped-selfcheck-read, historical-snapshot-labels]
key-files:
  created: [apps/api/src/static.ts, apps/status/index.html, apps/status/src/main.ts, apps/status/styles.css, packages/contracts/src/presentation.ts, packages/test-support/src/status-fixture.ts, tests/integration/static-assets.test.ts, tests/ui/status.spec.ts, tests/ui/accessibility.spec.ts, tests/unit/presentation.test.ts]
  modified: [apps/api/src/main.ts, apps/api/src/pairing.ts, packages/application/src/policy.ts, packages/domain/src/model.ts, packages/contracts/src/index.ts, scripts/build/build.mjs, playwright.config.ts, tests/integration/pairing.test.ts, tests/integration/process-lifecycle.test.ts, tests/unit/contracts.test.ts]
key-decisions:
  - "Public HTML/CSS/JS contains no installation/build observation; protected data is read only after actual pairing."
  - "Browser jobs:read is limited by the shared application to the current selfcheck projection's jobId, with no write/cancel/control permission."
  - "Historical successful installation does not expire when heartbeats become stale; current runtime confirmation is displayed separately."
  - "actualBuild=null never establishes absence of an older installation; only explicit previousInstallation=none enables the no-old-version wording."
  - "Unavailable manifest and platform diagnostics remain explicitly unverified until downstream trusted observation is connected."
requirements-completed: []
requirements-referenced: [DIST-01, SEC-01, ARCH-01]
duration: approximately 20min
completed: 2026-08-27
---

# Phase 1 Plan 7: Read-only Status UI and Shared Feedback Summary

**A real paired browser reads API/Worker, installation and selfcheck state through the local API; protected snapshots clear on authorization failure and become explicitly historical on network loss.**

## Performance

- **Execution:** approximately 2026-08-27 02:32–02:52 AEST
- **Tasks:** 3/3 automated implementation tasks
- **Files:** 20 implementation/config/test files plus this summary
- **Platform:** macOS 26.5.2 arm64, managed Node 24.20.0 / npm 11.19.0

## Accomplishments

- Production build now requires the status HTML, CSS and browser JavaScript. The API standalone entry serves these compiled assets at exactly `/status`, `/assets/status.css` and `/assets/status.js`. MIME types, exact transport checks, CSP, no-store and nosniff are preserved. Unknown paths, query-based path selectors and symlink assets are rejected; files are bounded and preloaded. The source-level API factory may still provide a generic shell for API-only fixtures, but the actual standalone service has no missing-assets fallback.
- Browser compilation uses the approved TypeScript 7.0.2 CLI. The build script is safe to import without executing the production build. A single fixed shared presentation module is included in a private scope; other imports, exports, Node globals and dynamic execution patterns are rejected. Browser assets receive no compile-time product identity, while API/Worker retain their existing immutable compiled identities.
- The native Chinese page follows the UI-SPEC typography, spacing, 960px layout, neutral palette, blue focus/refresh control and seven sections. It offers only refresh and pairing correlation information. No React, CDN, analytics, remote resources, school connection, management action or arbitrary execution interface was added.
- Pairing follows actual same-origin browser fetch semantics, pending cookie and correlation code, authenticated synthetic CLI approval, and one-time session exchange. Production UI never approves itself. No token is placed in URLs, localStorage or sessionStorage. CLI user confirmation itself remains Plan 06/14 work.
- The page reads `/api/status` and, when present, the current selfcheck's `/api/jobs/:id`. Job state, attempt, update time and inert result text come from actual SQLite-backed HTTP. The shared application refuses browser reads of other same-installation jobs, and existing write/cancel/control denials remain enforced.
- HTTP 401 and 403 erase protected DOM and in-memory snapshots. Network loss retains the last successfully read snapshot with its read time and an explicit historical label. The historical installation result is not silently erased or expired, but it does not claim that the API or Worker is currently reachable.
- Unknown, stale, stopped, healthy and degraded/error Worker observations are distinct. Only a fresh stopped observation uses the approved Worker-not-running copy; missing/old evidence says current state is unconfirmed.
- Shared pure functions provide bounded `code`, `stage`, `impact`, `nextAction` and copy. Successful installation requires matching target/actual identities, all four target-matching historical selfcheck observations, a selfcheck job, and completed cleanup. Rollback stays an upgrade failure. Explicit prior-installation evidence is required for first-install/no-old wording; missing values remain unknown.
- Real Chromium DOM tests exercise keyboard refresh/focus, native details, exactly one polite live region, concise refresh announcements, 320px layout and 200% CSS zoom with long inert Chinese/job text. No screenshots, video, HAR or trace were captured.

## Task Commits and TDD

| Task | RED | GREEN |
|---|---|---|
| 07-1: static API/build connection | `2c13716` | `955d7b9` |
| 07-2: actual read-only paired UI | `7de4ccb` | `865672a` |
| 07-3: shared feedback/accessibility | `a3716c7`, `0fee19d` | `3b0d979` |

Initial static/presentation RED runs failed at missing exported modules/options and executed no behavior tests; they are recorded as RED failures, not passing evidence. The pairing RED observed HTTP 403 where the approved current-selfcheck read needed HTTP 200. Browser RED runs failed for missing UI, then for missing historical/unknown-state behavior. The additional previous-installation RED rejected the new strict field and demonstrated the incorrect null-to-no-old inference before the fix.

## Verification Evidence

| Check | Evidence | Result |
|---|---|---|
| Static assets + pairing task regressions | I, actual API HTTP and temporary SQLite | 10/10 pass |
| Contracts + presentation | S, strict schema and pure feedback | 11/11 pass |
| Status browser tests | Synthetic browser E2E, actual HTTP/session/SQLite | 8/8 pass |
| Accessibility/history browser tests | Actual Chromium DOM, real synthetic JobRunner result | 2/2 pass |
| Full local suite | S/I/macOS N | **95/95 pass: 42 unit + 44 integration + 9 native**, 33.44s |
| Complete UI suite | Synthetic browser E2E | **10/10 pass**, 4.1s |
| Typecheck | TypeScript 7.0.2 `tsc --noEmit` | pass |
| Final production build | Actual API + Worker entries and three mandatory browser assets | pass |
| Independent orchestrator full suite | S/I/macOS N, final committed implementation | **95/95 pass**, 32.62s |
| Independent orchestrator UI | Actual Chromium, final committed implementation | **10/10 pass**, 3.5s |
| Independent orchestrator typecheck/build | TypeScript 7.0.2 / managed Node 24.20.0 | both exit 0 |
| Windows native/browser execution | N | **not_run** |
| Actual user visual judgment, CLI confirmation, update/Codex-exit UAT | Human/N | **not_run / human_needed**, Plan 14 |

The local final build before the task commit reported identity `25c13fb1327a295f05b0ce8c56ee1f2bf2e09ed0aba0fc45e3dc4a1b3fa97dad`. The independent final build of committed implementation reported `0ae94c4a626d7946833dc07ea6abc2065bf6b00f91dec38b50192a4245955362`. No version change, release, tag or artifact availability claim was made.

## Approved Deviations and Fixes

1. **Test/browser support:** Added the approved `status-fixture.ts` and isolated browser-path configuration. The fixture owns real API/SQLite objects and fresh synthetic in-memory credentials. It has no public fixture-control route and is not native-keyring or user-UAT evidence. The browser cache is only `.runtime/dev-toolchain/ui-browsers`.
2. **Read-only job projection:** Approved narrow changes to pairing, shared application policy and existing pairing tests permit only the current selfcheck job. No arbitrary job browsing, cancellation, enqueue or control authority was granted to the page.
3. **Existing lifecycle fixture:** Its temporary compiled API now receives the actual browser build assets. This preserves standalone production requirements instead of weakening startup to accommodate a fixture.
4. **Previous-installation evidence:** Approved optional `previousInstallation: none | present | unknown` in the domain/strict contract passes through the existing protected JSON projection storage. No table, column, route or permission was added. Omitted old records remain compatible and unknown. Synthetic UI cases separately exercise all three values; Plan 09 must populate this only from real inventory/journal evidence.
5. **TypeScript API mismatch:** The installed TypeScript 7 package does not expose the earlier compiler API. After a failing GREEN attempt, the builder was changed to the exact approved CLI; no compiler fallback or new dependency was installed.
6. **DOM and presentation corrections:** An initial `output` element unintentionally added a second status role and was replaced by ordinary text. A test expectation was corrected to compare the existing application-redacted result. Browser compilation initially exposed a private-name collision when combining the shared module; it now isolates that module's namespace. Each final affected test passed.

## Browser Provenance and Safety

- Official [Playwright browser documentation](https://playwright.dev/docs/browsers) and the installed 1.62.1 package registry were checked before the download. The local CLI dry-run identified the exact official URLs and isolated destination.
- Installed **Chromium Headless Shell 151.0.7922.34, revision 1234**, plus its CLI-selected FFmpeg revision 1011, from Playwright's official CDN. An actual `browser.version()` assertion confirms 151.0.7922.34. This is the approved existing dependency's development browser download, not a new library or global browser installation.
- The browser used isolated transient contexts, loopback-only test routing and the existing closed local proxy safeguard. The only hostile-looking text was synthetic inert job text; no school host was accessed. Default/shared browser caches and personal/persistent Profiles were not used.
- Screenshot, video and trace settings remain off. Playwright failure context files contained synthetic test state only and remained in ignored test output, not Git. No credential values, headers or raw network captures were added to artifacts.
- No OS prompt, login/MFA, release key, remote repository or publication action occurred. Full-suite synthetic native credentials were cleaned by the existing exact-namespace owned-process cleanup.

## Known Unobserved Fields and Downstream Connections

- **Manifest identity is intentionally unverified:** Status currently has no independent verified-manifest observation. Plan 06/09 must add the trusted observation and connect it; targetBuild is not a substitute. This plan does **not** claim full five-identity acceptance.
- **OS/CPU, pinned dependency versions, actual SQLite/browser versions and complete diagnostic verification** are explicitly unverified because this authenticated status schema does not expose their trusted observations. Plan 06/09/10 must connect real platform/artifact evidence; the browser must not infer it from navigator strings or hardcoded package values.
- **Prior-installation evidence:** Plan 09 must set the new field from actual inventory/journal facts. Synthetic `none` is not real installation inventory evidence.
- **CLI pairing:** Plan 06 must supply the actual human code-confirmation flow. Automated fixtures invoke the authenticated approval endpoint only to test protocol/UI wiring; they do not replace user approval.
- **Maintenance generations:** Preserve Plan 05's immutable generation and process hooks. Plan 09 still must stop obsolete candidate processes after maintenance exit, start normal fresh-generation services and verify them again.
- All empty/default DOM containers are populated only after successful authorization; they are not mock data sources. The unobserved fields above are explicit downstream contract gaps approved by the orchestrator, not fabricated completed diagnostics.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: scoped_read_permission | pairing.ts / policy.ts | Approved browser jobs:read is constrained to the currently projected selfcheck job and existing installation/destination policy. |
| threat_flag: projection_field | model.ts / contracts/index.ts | Optional prior-installation evidence crosses the existing authenticated installer projection boundary; null cannot establish absence. |

The planned T-01-11 UI boundary is covered by inert text rendering, CSP, authorization clearing and explicitly stale snapshots. New public assets contain no protected observations and expose no arbitrary filesystem selector.

## User Setup Required

None for this automated work. Windows native checks, actual visual/keyboard judgment and update/login/Codex-exit user gates remain unrun. Plan 12 trust/necessary OS actions and Plan 14 actual UAT remain hard human gates. Do not advance to Phase 2.

## Planning Ownership

The orchestrator owns shared STATE/ROADMAP/REQUIREMENTS/VALIDATION updates. No phase-wide requirement is marked complete here.

## Self-Check: PASSED

All 20 changed implementation/config/test files exist, all seven task commit hashes resolve, no task deleted tracked files, and all three built browser assets exist. Local and independent checks passed as recorded. `git diff --check` passes; generated/private runtime artifacts are not tracked or untracked task additions.
