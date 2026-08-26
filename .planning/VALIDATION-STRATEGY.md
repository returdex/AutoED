# M1 Validation Strategy

**Status:** approved acceptance baseline (2026-08-26); detailed phase PLAN approval still required.
**Execution evidence:** none; all implementation, install, integration and live checks are not_run.
**Date:** 2026-08-26

## Evidence ledger

| Code | Evidence | Proves | Does not prove |
|------|----------|--------|----------------|
| S | unit/contract, synthetic corpus and fake IdP/sites | deterministic contracts, negative cases, controlled browser behavior | real school auth, school permission, installed native behavior |
| I | actual SQLite, files, multiple processes, HTTP/stdio | persistence, wiring and crash behavior for tested build | real tenant compatibility or rights |
| N | native macOS/Windows install/runtime/client checks | declared OS/CPU/build works in recorded scenarios | an untested OS/CPU or school login |
| L | user-run authorized school/course UAT | specific source, account scope, platform/build/date behavior | perpetual sessions, all courses, unobserved history, hidden data rights |

Every requirement names the required evidence types. Record them separately; absence is `not_run`, unavailable human/environment work is `human_needed`, failed observations remain `failed`. Only actual matching evidence can become `passed`.

## Approval and release gates

### G0 — Initialization review

Passed on 2026-08-26: the user approved all 51 REQUIREMENTS, the eight-phase ROADMAP and five detailed proposals. M1 is ready to plan with target 0.1.0; this is not an implementation, test or release result. No runtime VERSION file, Git tag, remote repository, dependencies or application code is created during initialization.

### G1 — Plan approval

Each relevant PLAN must be confirmed by the user. After confirmation, proceed through in-scope implementation, automated checks/fixes, build and beta publication without asking for every mechanical step. Approval of one plan does not accept new scope, destinations, source access or unrelated plans.

Generic GSD auto-mode is not used as an authorization shortcut: it can auto-approve human-verify and decisions. Keep generic auto flags false and carry the scoped continuation policy in AGENTS/PROJECT/STATE. These are project instructions, not a claim that GSD runtime has a new enforcement setting. Do not edit global GSD workflows.

### G2 — Installable beta before manual tests

1. Finish applicable S/I and automated native installation/upgrade checks for the target build.
2. Confirm repo-local author/committer and authenticated GitHub identity are returdex; stop on mismatch. Current `gh` active account is ywan1303, so no authenticated remote mutation is allowed until corrected/verified in the future publication workflow.
3. Check intended repository ownership/name, source/asset secret scan, license notices, exact version and dependency/platform manifest; do not reuse a conflicting existing repository.
4. Publish a new immutable `0.1.0-beta.N` in the approved release scope, without overwriting a tag or asset. Later patch targets follow the approved x.y.z rules.
5. Verify that the intended platform assets are actually obtainable and match their manifest, and that the update path reaches the new build. Uploaded source code or a planned release is insufficient.
6. Give the user the precise version, update prompt, expected build identity, required manual steps and test cases. Stop for the user's manual update in Codex. Phase 1's foundation beta requires only the applicable install/upgrade checks, not school login; official-page login/MFA is requested only for an authentication-capable Phase 2 or later beta when the scenario needs it.
7. Persist reported results with platform/version/date/scenario and remaining gaps. A successful beta release is not evidence of passing live UAT.

If the installation/upgrade itself requires manual checks, publish after the automated prechecks and explicitly label native manual evidence pending; do not demand already completed manual installation proof before publishing the first testable beta. Never report those pending checks as passed.

### G3 — Early live authentication hard gate (Phase 2)

The following matrix is repeated for Moodle and EdStem on both declared native target platforms, with versions/architecture recorded. Actual institutions/courses and devices are selected before the POC, not guessed during initialization.

| Scenario | Moodle macOS | Moodle Windows | Ed macOS | Ed Windows |
|----------|--------------|----------------|----------|------------|
| Visible official login / manual MFA / correct account binding | not_run | not_run | not_run | not_run |
| Dedicated Profile normal close/reopen three times | not_run | not_run | not_run | not_run |
| Worker restart and minimal protected read | not_run | not_run | not_run | not_run |
| OS restart and correct installed entrypoint | not_run | not_run | not_run | not_run |
| Codex fully exited while backend performs bounded read | not_run | not_run | not_run | not_run |
| Real elapsed time at least 24 hours / auth probe | not_run | not_run | not_run | not_run |
| Explicit logout or natural expiry, reauth, last data retained | not_run | not_run | not_run | not_run |
| Actual account binding and selected authorized source scope | not_run | not_run | not_run | not_run |
| Profile exclusion, correct build and no sensitive output | not_run | not_run | not_run | not_run |

Separate required automated fault ledger: account-change/mismatched-binding isolation, permission-denied response, network interruption, parser drift and stale-worker concurrency each require S/I evidence, currently all `not_run`. Passing them does not fill a live matrix cell. The live matrix verifies actual account identity, the approved scope and real authentication/reuse behavior; any naturally observed real failure is recorded additionally. Do not intentionally provoke school errors, probe unauthorized pages or require a second real account without separate scope authorization. An additionally authorized live account-switch test is supplementary; it does not replace the mandatory S/I isolation negatives.

No requirement to force schools to expire a session at a particular hour; use explicit logout where permitted for the expiry scenario. A 72-hour observation remains optional/proposed, not a hidden release blocker.

Any missing/failed required live cell blocks dependent phases. Missing Windows device/source access yields human_needed. The only scope reduction path is explicit user approval plus consistent requirement/roadmap changes; marking a source unsupported does not pass a dual-source milestone.

### G4 — Full course and delivery acceptance

Reconcile manifests against the user's selected course scope and file classifications: directory/pages, announcements, threads/replies, file resources, assessments/times, personally visible grades/feedback and retained history. Each discovered resource has separate discovery/fetch/archive/extraction/model-access status and reason for exceptions.

Use current/ended course samples and observed changes plus synthetic cross-semester scenarios. Never call a simulated semester real longitudinal evidence or promise recovery of history deleted before initial capture.

In the actual installed Codex integration, enumerate resources, fix revisions, page to end, compare reconstructed permitted text with the archive representation, and retrieve supported original-file bytes. Compare install/build/API/Worker/CLI/MCP identities; stop API and verify unavailable behavior. Run without an LLM Key for backend sync. Generic protocol tests support other models but do not claim every host/version was tested.

Final native tests cover clean install, repeat install, beta-to-beta upgrade, downgrade rejection, interrupted migration, file locks, new writes after upgrade, credential protection, user startup opt-in, disk-full recovery, version cleanup, data-preserving uninstall and consistent restore. Do not promise Profile rollback or reuse by an older Chromium after an upgrade.

## Failure cases to include in phase plans

- Auth: URL/200 false positive, account mismatch, transient network vs login, concurrent login/sync, orphaned owned process, stale lease/fence.
- Data: valid empty vs parser error/partial page, missing item vs verified deletion, duplicate titles/terms, UTC/DST/unknown timezone, parser revision vs source revision.
- Files: redirect to private address, wrong MIME, truncated/changed-version range, path/junction escape, ZIP bomb, encrypted/corrupt document, parser timeout, disk full.
- Read/policy: cursor tampering, revision deleted during paging, permission revoked mid-read, title/URL leak, binary-host unsupported, unsafe HTML and prompt injection.
- Persistence: kill before/after object publish, DB commit, checkpoint, lease loss and response; old worker cannot commit; resume does not duplicate revisions/events.
- Upgrade: wrong account, wrong platform/build, old active process, mismatched components, unavailable asset, failed migration, data incompatible with old binary, cleanup pending.

## Safe UAT records

Record opaque scope/source labels, native OS/CPU, product/runtime/browser versions, beta tag/build, dates/elapsed time, scenario, result and next action. Keep real course bodies, grades, identifiers needing protection, Profile paths, Cookie/token/password/MFA, private screenshots, HAR, traces and raw network captures out of Git, CI and diagnostics.

User feedback is evidence of the stated scenario, not permission to broaden course scope or destinations. Do not request secrets in order to debug. Required human work remains paused until the user supplies the result or explicitly revises scope.
