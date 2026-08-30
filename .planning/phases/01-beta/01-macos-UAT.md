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

