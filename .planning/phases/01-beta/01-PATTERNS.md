# Phase 1 — Greenfield Pattern Map

**Mapped:** 2026-08-27 · **Status:** planning only · **Code analogs:** 0/20

## Evidence and Scope

gsd-pattern-mapper searched only the new repository. It contains planning/research, original rebuild inputs, AGENTS, license files and .gitignore; no product source, dependency manifest, installer, tests or project-local skills. No legacy code/runtime, installed AutoED tool, Profile or credentials were accessed. No code excerpts can honestly be copied.

Phase RESEARCH was not yet available when mapping began. All paths below are illustrative responsibilities derived from `.planning/research/ARCHITECTURE.md`, not existing files or approved exact filenames. Planner must reconcile them with `01-RESEARCH.md` and finalize concrete paths in PLAN files.

## File Classification

| Proposed file group | Role / data flow | Code analog | Required boundary |
|---|---|---|---|
| package/workspace/TypeScript/lockfile config | config/build | None | Verified exact versions and native artifact matrix |
| packages/contracts/src/status, build, jobs | schema/request-response | None | Shared status and actual build identity |
| packages/domain/src/scope, revision, job | model/transform | None | No HTTP/MCP/browser/DB imports |
| packages/application/src/ports, status, jobs | use cases/request-response | None | Shared policy and persistence/provider ports |
| packages/persistence/src/database, migrations | store/file I/O | None | Actual SQLite/WAL and migration compatibility |
| packages/persistence/src/jobs | store/event-driven | None | Conditional claims, deduplication, fences, cancellation |
| packages/platform/src/paths, credentials | utility/file I/O | None | Isolated roots, native protection, no secret output |
| packages/platform/src/processes | service/process | None | Owned independent processes; no broad killing |
| apps/api/src/main, routes | controller/HTTP | None | Authenticated loopback -> application |
| apps/api/src/security | middleware/HTTP | None | Host/Origin, pairing, scope, mutation checks |
| apps/worker/src/main, runner | service/jobs | None | Durable synthetic work, stale owner rejection |
| packages/test-support/src/synthetic-provider | provider/batch | None | Public fake data, no school claims |
| apps/cli/src/main, status | client/HTTP | None | Real installed entrypoint and backend |
| apps/mcp/src/main, backend-client | client/stdio+HTTP | None | Thin client, no DB/Profile access |
| apps/web/src/status, styles | UI/HTTP | None | Minimal approved UI-SPEC, not P7 console |
| packages/installer/src/preview, install | installer/file+process | None | Scope-bound approval, repeat-safe operations |
| packages/installer/src/upgrade, recovery, journal | installer/durable recovery | None | Safe restoration, real self-check, complete cleanup |
| scripts/release, manifests, installation docs | release/batch | None | Immutable beta, correct identity, obtainable artifacts |
| tests/unit, tests/integration | tests/contracts+real local | None | Security, jobs, processes, version/failure evidence |
| tests/native, UI tests, manual checklist | tests/native install | None | Both native OS; beta before manual testing |

## Shared Patterns to Preserve

- **Dependency direction:** API/Worker separate; UI/CLI/MCP use the same application contracts. Internal injection is fine, but injected callbacks are not proof of installed client wiring. P1 is synthetic control-plane/version wiring; real course MCP remains P3.
- **Startup:** CONTEXT D-01–D-03 require on-demand startup, no login autostart, survival after Codex exit, automatic post-install/upgrade startup+self-check. Native evidence is required; a detached flag alone proves nothing.
- **Security:** AGENTS and SEC-01 require loopback, authentication, precise Host/Origin, scope and mutation checks, native credential protection without plaintext fallback, and safe error outputs. Page/file content is untrusted; no arbitrary MCP URL/JS/selector. No Profile paths, secrets, raw requests or environment dumps.
- **Durability:** Conditional claims, idempotency, fenced commits, cancellation distinction and bounded retry; stale workers cannot commit. Lease expiry does not prove process exit. Concrete SQL/enums are planning choices, not existing patterns.
- **Installation:** CONTEXT D-02–D-08/D-12 require explicit preview, one approval for that scope, escalation on changed impact, actual new-version behavior, managed cleanup and no legacy uninstall. cleanup_pending is not success. Restoration reports upgrade failure; unsafe recovery stops, does not overwrite new data or restore Profile. First install has no fictional prior version.
- **Identity/release:** DIST-01–03 and D-13–D-14 require actual component identity, returdex author/committer AND remote auth, no same-name takeover, standard license, immutable beta and artifact availability before human checks. Publishing is not evidence of a passing test.
- **UI:** Follow `01-UI-SPEC.md`, no existing framework. Refresh is read-only; no browser process launcher. Network stale snapshots differ from auth loss, which hides protected data. No fabricated status or version. Use declared visual defaults and exact error/next-step semantics.
- **Verification:** Separate S/I/N/L. P1 synthetic content with real SQLite/process/installed integration. Test competing workers, stale fences, restart, cancellation, two-build upgrade, failed migration, stale entrypoint, cleanup failure and preservation of unrelated data/processes. WSL or Windows-shaped fixtures do not prove native Windows behavior.

## Canonical References

- `AGENTS.md` — safety and workflow boundaries.
- `.planning/phases/01-beta/01-CONTEXT.md` — D-01–D-16 locked decisions, original P1-D aliases preserved.
- `.planning/phases/01-beta/01-UI-SPEC.md` — minimal UI/terminal feedback contract.
- `.planning/REQUIREMENTS.md` — Phase 1 eight requirements.
- `.planning/VALIDATION-STRATEGY.md` — evidence and human gates.
- `.planning/research/ARCHITECTURE.md` — proposed responsibilities, not verified code.
- `.planning/phases/01-beta/01-RESEARCH.md` — forthcoming phase research; reconcile before planning.

## No Analog Found

All 20 groups are new. Establish first tested implementations after PLAN approval and then use them as local analogs. Do not import legacy state or claim research pseudocode is validated code. Real school connectors/login, full course/file functionality and full management UI stay in their later phases.
