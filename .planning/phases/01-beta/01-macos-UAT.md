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
