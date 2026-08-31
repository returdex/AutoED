# Phase 2 Plan Outline

**Plans:** 41 plans in 35 waves. Numeric IDs 35–41 execute by explicit dependencies rather than numeric order; 40 executes between future Windows update (25) and A1 (26).

| Plan ID | Objective | Wave | Depends On | Requirements |
|---|---|---:|---|---|
| 02-01 | Strict auth/Profile/evidence domain contracts and test skeletons. | 1 | none | AUTH-01, AUTH-02, AUTH-03, SEC-02, UAT-01 |
| 02-02 | Transactional auth/config/binding/Profile/evidence persistence. | 2 | 02-01 | AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-03 | Exclusive protected Profile ownership and safe reclaim proof. | 2 | 02-01 | AUTH-04, SEC-02 |
| 02-04 | Two-source authentication/binding state machine. | 2 | 02-01 | AUTH-01, AUTH-03, SEC-02 |
| 02-05 | Local Playwright BrowserProvider and ProfileCoordinator. | 3 | 02-01, 02-03 | AUTH-01, AUTH-04, SEC-02 |
| 02-06 | Sealed Moodle/EdStem read-only auth adapters and hostile fixtures. | 4 | 02-01, 02-05 | AUTH-01, AUTH-03, SEC-02 |
| 02-07 | Durable auth jobs, bounded retries and Worker fencing. | 5 | 02-02, 02-03, 02-04, 02-05, 02-06 | AUTH-03, AUTH-04, SEC-02 |
| 02-08 | Paired fixed auth API, policies and protected/redacted presenters; ordinary login actions remain restart-revoked and non-evidence. | 6 | 02-02, 02-04, 02-06, 02-07 | AUTH-01, AUTH-03, SEC-02, UAT-01 |
| 02-09 | Approved paired status UI and truthful lifecycle/evidence gaps. | 7 | 02-02, 02-08 | AUTH-03, SEC-02, UAT-01 |
| 02-10 | Cross-layer S/I security, ownership and evidence-isolation matrix using exact requiredness. | 7 | 02-02, 02-04, 02-06, 02-07, 02-08, 02-35 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-11 | Synthetic browser/UI E2E with no N/L promotion. | 8 | 02-06, 02-08, 02-09, 02-35 | AUTH-01, AUTH-02, AUTH-03, SEC-02, UAT-01 |
| 02-12 | macOS native Profile/process lifecycle evidence. | 6 | 02-03, 02-05, 02-07 | AUTH-02, AUTH-04, SEC-02 |
| 02-35 | Exact 176-possible/44-required-L registry plus durable live-action contracts/store. | 6 | 02-02, 02-07 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-36 | Paired-server durable A/B/C/D/reauth workflows and payload-external transactional L authority for both platforms. | 8 | 02-08, 02-09, 02-35 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-37 | Complete signed live/audit/final/update gate branches and current-build native S/I/N producer before release. | 9 | 02-35, 02-36 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-41 | Finalize/test all release tooling before selecting one immutable source identity. | 10 | 02-37 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-38 | Select one immutable beta identity and bind full quality/security evidence without source edits. | 11 | 02-10, 02-11, 02-12, 02-36, 02-37, 02-41 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-39 | Assemble, sign and locally verify dual-target artifacts without source edits. | 12 | 02-38 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-13 | Publish once and anonymously verify availability without source edits. | 13 | 02-39 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-14 | Hard human gate: actual macOS Codex update. | 14 | 02-13 | AUTH-02, UAT-01 |
| 02-15 | Hard human gate: paired local source/account/organization/course/destination confirmation. | 15 | 02-14 | AUTH-01, AUTH-03, SEC-02, UAT-01 |
| 02-16 | Hard human gate: macOS A1 login/MFA. | 16 | 02-15 | AUTH-01, SEC-02, UAT-01 |
| 02-17 | Hard human gate: macOS A2 identity/binding/course visibility. | 17 | 02-16 | AUTH-01, AUTH-02, AUTH-03, SEC-02, UAT-01 |
| 02-18 | Hard human gate: macOS B1 three Profile reopen rounds. | 18 | 02-17 | AUTH-02, AUTH-04, UAT-01 |
| 02-19 | Hard human gate: macOS B2 Worker restart. | 19 | 02-18 | AUTH-02, AUTH-04, UAT-01 |
| 02-20 | Hard human gate: macOS B3 actual Codex exit/reentry. | 20 | 02-19 | AUTH-02, AUTH-04, UAT-01 |
| 02-21 | Hard human gate: macOS C full OS restart. | 21 | 02-20 | AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-22 | Hard human gate: macOS D real ≥24-hour recheck. | 22 | 02-21 | AUTH-02, AUTH-03, UAT-01 |
| 02-23 | Hard human gate: macOS reauth. | 23 | 02-22 | AUTH-02, AUTH-03, SEC-02, UAT-01 |
| 02-24 | macOS-first hard stop; audit Windows 88 possible/22 required-L gaps and wait for exact future resume. | 24 | 02-23 | AUTH-02, AUTH-04, UAT-01 |
| 02-25 | Future hard human gate: actual native Windows immutable-beta update; release only 02-40. | 25 | 02-24 | AUTH-02, AUTH-04, UAT-01 |
| 02-40 | Produce/verify current-build native Windows named S/I/N obligations before any Windows L action. | 26 | 02-25 | AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
| 02-26 | Future hard human gate: Windows A1 login/MFA, consuming signed gate and 02-40 receipt. | 27 | 02-40 | AUTH-01, AUTH-02, SEC-02, UAT-01 |
| 02-27 | Future hard human gate: Windows A2 identity/binding/course visibility. | 28 | 02-26 | AUTH-01, AUTH-02, AUTH-03, SEC-02, UAT-01 |
| 02-28 | Future hard human gate: Windows B1 three Profile reopen rounds. | 29 | 02-27 | AUTH-02, AUTH-04, UAT-01 |
| 02-29 | Future hard human gate: Windows B2 Worker restart. | 30 | 02-28 | AUTH-02, AUTH-04, UAT-01 |
| 02-30 | Future hard human gate: Windows B3 actual Codex exit/reentry. | 31 | 02-29 | AUTH-02, AUTH-04, UAT-01 |
| 02-31 | Future hard human gate: Windows C full OS restart. | 32 | 02-30 | AUTH-02, AUTH-03, AUTH-04, UAT-01 |
| 02-32 | Future hard human gate: Windows D real ≥24-hour recheck. | 33 | 02-31 | AUTH-02, AUTH-03, UAT-01 |
| 02-33 | Future hard human gate: Windows reauth. | 34 | 02-32 | AUTH-02, AUTH-03, SEC-02, UAT-01 |
| 02-34 | Final exact-requiredness gate: 176 possible, 44 required L, named S/I/N and all Phase 1/2 prerequisites. | 35 | 02-33 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01 |
