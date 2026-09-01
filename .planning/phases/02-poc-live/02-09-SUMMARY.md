---
phase: 02-poc-live
plan: "09"
subsystem: local-auth-ui
tags: [paired-loopback, privacy, csrf, responsive-ui, playwright, evidence-ledger]
requires:
  - phase: 02-poc-live
    plan: "02"
    provides: strict source, binding, evidence-cell and receipt contracts
  - phase: 02-poc-live
    plan: "08"
    provides: paired CSRF auth routes, protected status projection and redacted receipt reads
provides:
  - protected paired dual-source status UI with fixed information architecture and preserved runtime diagnostics
  - one-primary-action auth reducer using only fixed paired CSRF commands and memory-only server intent
  - denial purge, timestamped stale snapshots and allowlisted redacted receipt copy
  - synthetic real-DOM coverage for privacy, accessibility and 1280/759/599/320 responsive layouts
affects: [02-10 security matrix, 02-11 synthetic E2E, 02-14 live UAT, AUTH-03, SEC-02, UAT-01]
tech-stack:
  added: []
  patterns: [protected text-node rendering, fixed action reducer, synchronous denial purge, explicit clipboard allowlist, server-projected authority fields]
key-files:
  created:
    - tests/ui/auth-status.spec.ts
  modified:
    - apps/status/src/main.ts
    - apps/status/styles.css
    - packages/domain/src/model.ts
    - packages/contracts/src/index.ts
    - packages/contracts/src/presentation.ts
    - packages/application/src/policy.ts
    - apps/api/src/main.ts
    - tests/unit/output-policy.test.ts
    - tests/integration/auth-api.test.ts
    - tests/ui/accessibility.spec.ts
key-decisions:
  - "The browser renders only exact protected projection fields into safe text nodes; private identity is never reconstructed from receipts, diagnostics or unknown response fields."
  - "Every UI mutation is selected by the server projection and rebuilt as a route-specific allowlisted body; the login intent remains memory-only and is cleared before its one permitted consumption."
  - "Durable checkpoint receipts retain independent platform/source/scenario/evidence labels, while Windows and Phase 3 remain explicitly blocked regardless of synthetic macOS state."
patterns-established:
  - "Protected UI purge: any auth, job, receipt or mutation 401/403 clears snapshots, CSRF, pending intent, clipboard source and protected DOM before pairing restarts."
  - "Stale honesty: network/service failures preserve the last paired snapshot only with its original read time, repeated stale labels and disabled mutations."
requirements-completed: []
duration: 30min
completed: 2026-09-01
---

# Phase 2 Plan 09: Paired Dual-Source Auth Status UI Summary

**A protected local status page now presents Moodle and EdStem identity, binding and checkpoint evidence without crossing public, clipboard, storage, ARIA or diagnostic boundaries, while all actions remain fixed paired commands and every hard live/platform gate stays blocked.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-01T06:28:56Z
- **Completed:** 2026-09-01T06:58:25Z
- **Tasks:** 2 TDD tasks plus one authorized upstream contract correction
- **Files modified:** 11 source/test files

## Accomplishments

- Rendered the approved OverallGate → PrivacyNotice → equal Moodle/EdStem SourceCards → BindingPanel → LoginActionPanel → macOS checkpoint ledger → platform gaps → existing diagnostics order, with distinct auth/capability/health/freshness/completeness labels and text-plus-border status badges.
- Kept complete synthetic identity/course values exclusively in the paired protected visible-text area; public DOM, attributes, live-region, URL, storage, clipboard, diagnostics and errors remain free of those sentinels.
- Added a single-primary-action reducer for exact login, login-completion probe and binding-confirm commands with same-origin cookie/CSRF admission, busy de-duplication and memory-only server-issued intent handling.
- Added shared purge behavior for status, receipt, job and mutation denial, plus timestamped stale rendering that labels every protected group and disables mutations until a successful read.
- Presented all 22 macOS source/scenario/L cells independently, server-projected D earliest-recheck time, explicit Windows `not_run / human_needed`, and the unchanged Phase 3 block; no live receipt or pass was created.
- Preserved the Phase 1 version, runtime, install, self-check and diagnostic semantics below the new auth interface.

## Task Commits

The upstream correction and both tasks followed RED then GREEN:

1. **Authorized Rule 2 RED: missing protected projection authority fields** — `066253b` (test)
2. **Authorized Rule 2 GREEN: strict protected projection correction** — `0de073d` (fix)
3. **Task 1 RED: paired status structure and privacy coverage** — `be463c2` (test)
4. **Task 1 GREEN: dual-source protected status rendering** — `5b5476a` (feat)
5. **Task 2 RED: actions, intent, purge, stale and layout coverage** — `3512064` (test)
6. **Task 2 GREEN: secure interactions and responsive styling** — `64b5ed2` (feat)
7. **Regression fix: existing install/accessibility semantics** — `8dab44d` (fix)

No separate REFACTOR commit was needed.

## Files Created/Modified

- `tests/ui/auth-status.spec.ts` — Synthetic loopback browser fixture and 12 paired/public UI tests covering information architecture, privacy, fixed actions, intent lifetime, clipboard, purge, stale recovery and responsive accessibility.
- `apps/status/src/main.ts` — Protected projection renderer, evidence ledger, fixed action reducer, purge/stale behavior, safe errors, clipboard allowlist and preserved install/runtime presenters.
- `apps/status/styles.css` — Approved 960px layout, 760/600 breakpoints, 48px controls, focus ring, primary/secondary actions and semantic status borders.
- `packages/domain/src/model.ts` — Optional protected-local selected-course display label.
- `packages/contracts/src/index.ts` — Strict selected-course validation in the protected identity contract.
- `packages/contracts/src/presentation.ts` — Server projection of approved scope, per-source course access/fingerprint and D earliest-recheck authority.
- `packages/application/src/policy.ts` — Server-selected fixed action scope in the protected next-action projection.
- `apps/api/src/main.ts` — Injectable request-limit clock used only by synthetic repeated-refresh coverage; the production limit remains 30 requests per window.
- `tests/unit/output-policy.test.ts` — Contract RED/GREEN evidence for the newly required protected and receipt fields.
- `tests/integration/auth-api.test.ts` — Actual paired HTTP evidence for the strict server projection.
- `tests/ui/accessibility.spec.ts` — Explicit control selectors and keyboard traversal after the approved UI added multiple buttons.

## Verification

- Complete local Playwright UI suite: **22/22 passed** with screenshot, trace and video disabled.
- Focused paired auth UI: **12/12 passed**; Task 2 action/privacy/layout subset: **7/7 passed**.
- Existing real-browser loopback pairing/offline/purge regression: **passed**.
- Focused protected output policy: **12/12 passed**.
- Focused actual auth API integration: **5/5 passed**.
- TypeScript typecheck: **passed**.
- Managed Node 24.20.0 build: **passed**, four application entries built; no release or tag created.
- Static unsafe-DOM/storage/log scan found no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, storage access or console calls in the status client.
- Computed UI checks passed at 1280px, 759px, 599px and 320px plus 200% zoom: equal desktop cards, single-column breakpoints, no horizontal overflow, minimum 48px controls and 2px/4px keyboard focus.
- The in-app browser backend was unavailable, so no additional interactive screenshot pass was performed; the plan-required local Playwright real-DOM verification is complete and screenshots were intentionally not generated.

All evidence is synthetic UI/S, unit or integration evidence. No official page, school source, real login, MFA, persistent Profile content, credential, live action, publication, native result or L evidence was accessed or created.

## Decisions Made

- Kept the UI consumer schema local and exact instead of importing the Node-oriented presentation module into browser assets; this avoids bundling server dependencies while preserving the already-tested Phase 1 presenter semantics.
- Used the protected server projection as the only source of approved configuration, scope, candidate and authority time; the browser does not guess scope, compute D eligibility or render unknown fields.
- Kept receipt reads as the fixed complete EvidenceCellKey enumeration and exposed only a test clock seam for repeated synthetic refresh. Production rate-limit strength is unchanged.
- Preserved AUTH-03, SEC-02 and UAT-01 as Pending because synthetic UI behavior is not real login, native or user-run live evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Completed the server-projected UI authority contract**
- **Found during:** Pre-Task 1 contract audit
- **Issue:** The approved UI required fixed action scope, per-source course access/fingerprint, protected selected-course display and D earliest-recheck authority, but the strict 02-08 DTO did not project them. Implementing the UI without them would require forbidden client guesses or client-computed authority.
- **Fix:** Added only the required protected-local fields and fixed next-action scope, projected them from existing stores, and derived D earliest recheck on the server. No generic operation, receipt write route or new authority was added.
- **Files modified:** `packages/domain/src/model.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/presentation.ts`, `packages/application/src/policy.ts`, `tests/unit/output-policy.test.ts`, `tests/integration/auth-api.test.ts`
- **Verification:** Output policy 12/12, auth API 5/5 and typecheck pass.
- **Committed in:** `066253b`, `0de073d`

**2. [Rule 3 - Blocking] Added deterministic rate-window time for complete synthetic ledger refreshes**
- **Found during:** Task 2 stale-recovery verification
- **Issue:** One complete protected refresh reads 22 fixed receipt cells. A second immediate synthetic refresh correctly reached the production 30-request window before the recovery assertion could observe a successful read.
- **Fix:** Injected only the request-limit clock into test composition so the synthetic test can advance between calls; the limit value, routes and production clock/default behavior remain unchanged.
- **Files modified:** `apps/api/src/main.ts`, `tests/ui/auth-status.spec.ts`
- **Verification:** Offline-to-current recovery passes and all actual API authorization tests remain green.
- **Committed in:** `64b5ed2`

**3. [Rule 1 - Bug] Preserved verified-install copy and keyboard regression behavior**
- **Found during:** Final complete UI regression
- **Issue:** Removing the browser import of the Node-oriented presentation module omitted the verified-install success branch, and legacy accessibility selectors assumed the status page contained only one button. A disabled refresh also lost focus during keyboard activation.
- **Fix:** Restored the exact evidence-gated install-success presenter locally, returned focus to a keyboard-activated refresh, and updated regression selectors/traversal to address the approved named controls.
- **Files modified:** `apps/status/src/main.ts`, `tests/ui/accessibility.spec.ts`
- **Verification:** Focused accessibility 2/2 and complete UI 22/22 pass.
- **Committed in:** `8dab44d`

---

**Total deviations:** 3 auto-fixed (1 missing critical authority contract, 1 blocking synthetic verification seam, 1 regression bug). **Impact:** All changes were required to implement and verify the approved strict UI without client-generated authority or weakened privacy/security; no live, source, publication or platform scope was added.

## Issues Encountered

- The default shell used Node 26.0.0, which correctly failed the pinned build check. Re-running the build with the already installed managed Node 24.20.0 succeeded; no dependency or runtime version changed.
- The in-app browser backend was unavailable. The required local Playwright suite remained available and passed without enabling screenshots, trace, video or external traffic.

## Known Stubs

None. Empty receipt arrays and nullable snapshots are intentional not-observed/purge states backed by actual paired API reads; they do not stand in for live success. Missing auth composition remains an intentional fail-closed 503 path.

## Threat Flags

None. The protected projection adjustment is the explicitly authorized existing auth trust-boundary correction, and the UI consumes only already approved paired routes. No endpoint, arbitrary browser capability, file access, credential field, live evidence authority or external network surface was added.

## Authentication Gates

None. The plan intentionally did not open an official login, request credentials/MFA, access a Profile or perform live UAT.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-10 can audit the exact paired UI/API/privacy matrix against the fixed route and projection surface.
- Plan 02-11 can drive the same synthetic browser UI end to end without substituting fixture evidence for native/live results.
- Windows remains `not_run / human_needed`; Phase 1 remains partial, Phase 2 is not globally passed, Phase 3 remains blocked, and AUTH-03/SEC-02/UAT-01 remain Pending until their required evidence gates.

## Self-Check: PASSED

All 11 listed source/test files and this SUMMARY exist; commits `066253b`, `0de073d`, `be463c2`, `5b5476a`, `3512064`, `64b5ed2` and `8dab44d` are present in order; full UI, focused unit/integration, typecheck, managed build and static security gates pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
