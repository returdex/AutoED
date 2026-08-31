# Phase 1 macOS UAT Evidence

## 2026-08-30 — Codex reload and MCP execution path

Status: **partial pass / human gate remains open**

User-reported evidence from the installed `0.1.0-beta.7` build after reloading Codex:

| Check | Observed result | Verdict |
|---|---|---|
| `autoed_status` | MCP, API and Worker reported `healthy`; version `0.1.0-beta.7`; installation `succeeded`; cleanup `complete` | pass |
| `autoed_selftest(kind="echo", value="beta")` | Created persistent job `4bea2586-026c-4336-a364-3d3d698efbca`; initial state `queued` | pass |
| `autoed_job_get` | Final state `succeeded`; attempts `1`; result `beta`; error code `null` | pass |

This evidence confirms, for this macOS installation and this test run, that the reloaded Codex host loaded the installed MCP tools and that stdio MCP, backend connectivity, durable job submission/retrieval and echo Worker execution completed successfully.

It does **not** establish the remaining Plan 14 macOS acceptance items: clean no-Node installation, published A-to-B update and digest behavior, service survival while Codex is exited, independent terminal verification, OS authorization denial, controlled recovery/rollback, UI accessibility, or the complete native diagnostics ledger. Hardware/OS build and artifact hash were not included in this feedback and remain unrecorded. Windows 11 native evidence remains `not_run / human_needed`.

## 2026-08-30 — Service survival while Codex was exited

Status: **pass for independent service survival and echo execution**

The user fully exited Codex and used the installed absolute CLI entry from Terminal. The CLI authenticated successfully against build `90710aeff0c40f946875c95f36a67b1090f24397f83a7735f4b6b651bed3b282` (`0.1.0-beta.7`); API and Worker were both fresh and `healthy`; installation remained `succeeded` with cleanup `complete`.

While Codex was exited, the user submitted echo job `767ec4fc-0f6c-4975-b3fe-5c811911ec24` with value `after-codex-exit`. The submitted state was `queued`. A subsequent authenticated read observed terminal state `succeeded`, attempt `1`, result `after-codex-exit`, and error code `null`.

This closes the macOS beta.7 evidence slice for API/Worker independence from the Codex process and persistent Worker execution. It does not close the remaining A-to-B update/digest, denial/recovery, UI, complete packaged diagnostics, clean-account/no-Node, or Windows 11 native checks.

## 2026-08-31 — beta.19 status UI accessibility and refresh

Status: **pass for the user-run status UI slice**

After the successful `0.1.0-beta.19` installation, MCP reload, durable echo job, and independent-service checks, the user followed the supplied status-page checklist and reported “管理页面通过”. The checklist covered local pairing, beta/API/Worker status presentation, keyboard-only navigation with Tab/Shift+Tab/Enter, approximately 320 CSS-pixel width at 200% zoom, refresh without creating a new job, and non-success treatment of `stale`/`unknown` states.

This is user-reported native macOS UAT; no screenshot, browser secret, Profile data, or school data was requested or recorded. It closes only the beta.19 status UI slice. OS-authorization denial and controlled synthetic recovery remain `human_needed`; Windows 11 native evidence remains `not_run / human_needed`, and Phase 1 is not complete.

## 2026-08-31 — beta.19 packaged native diagnostics

Status: **pass for all three packaged synthetic scenarios on native macOS arm64**

The user ran the diagnostics shipped inside the installed beta.19 program with its managed Node 24.20.0. Each run used a fresh protected directory below the OS temporary directory and targeted `darwin-arm64`.

| Scenario | Result | Reported codes |
|---|---|---|
| `install-recovery` | pass | `OWNED_ROOT_PROTECTED`, `NO_USER_DATA`, `INTENT_DURABLE`, `RECOVERY_REOPENED` |
| `permissions` | pass | `OWNED_ROOT_PROTECTED`, `NO_USER_DATA`, `ACL_PROTECTED` |
| `jobs` | pass | `OWNED_ROOT_PROTECTED`, `NO_USER_DATA`, `MODULE_CLOSURE_LOCAL`, `DUAL_CONNECTION_FENCED`, `CANCEL_CONFIRMED` |

These are packaged synthetic diagnostics executed on the declared native OS; they confirm the installed diagnostic closure, protected temporary-root behavior, durable recovery-journal primitive, permission-mode probe, local SQLite dependency closure, competing-claim fencing, and confirmed cancellation behavior. They do not constitute a real Keychain authorization denial, destructive failure injection against the active installation, clean-account/no-Node evidence, school login/live evidence, or Windows native evidence. Those unrun gates retain their prior states.

## 2026-08-31 — separate standard-account installation

Status: **pass for separate-account installation and managed stop; no-Node and authorization-denial gates remain open**

The user created a new macOS standard account and followed the shared beta.19 installation guide. `command -v node` found a host Node 26, so this run does not establish the clean-account/no-Node condition. The verified beta.19 bootstrap nevertheless completed through its managed runtime and returned:

- operation ID `4d41d661-fb22-4569-aa25-9d30d3139f63`
- generation `1`
- build ID `77548191f4a238a94c7ec0525ca8e51719c138040b9a1a489bea52a086e56741`
- state `complete`
- cleanup `complete`

No macOS password or Keychain authorization prompt appeared. Therefore authorization denial is `not_observed`, not pass or fail; the user did not manufacture a denial by locking or damaging the Keychain. The test-account API and Worker continued to own the fixed port after account switching, which safely prevented the primary account from starting. The agent did not kill those other-user processes. The user returned to the test account and used its managed CLI `stop`, reporting the normal stopped result. The primary beta.19 installation then started successfully; its CLI, API and Worker were observed as beta.19, with API and Worker `healthy/fresh`.

This closes the separate-standard-account installation, successful first-install identity/cleanup, managed stop, cross-user ownership-safe handling, and primary-service restoration slices. It does not close no-Node, real OS authorization denial, Windows native, or Phase 1 overall acceptance.
