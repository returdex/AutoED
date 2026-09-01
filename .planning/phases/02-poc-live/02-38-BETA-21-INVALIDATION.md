# Phase 2 beta.21 invalidation

Status: `invalidated`

The immutable selection `0.1.0-beta.21` / `v0.1.0-beta.21` is permanently excluded from Phase 2 release use. Its original selection receipt remains preserved in Git commit `13d8f18`; it must not be rewritten, restored as the active selection, or used to create a Phase 2 test report, tag, release, or artifact.

Public identity:

- Source commit: `2241eb4aed0bc510e778c03e3d8fd2049b92a75e`
- Source tree: `fa99c25dcb83040441fed493623d1cb0c936b3c9`
- Build ID: `466e4e4c560f75030e1b0ea101437e80f6cc9e8dea596f2110f92e50d777dda5`
- Selection digest: `fce080f868869c9b92f598f98a6c248163911c8d3a75cc7d305773e2dcf2d798`

Invalidation basis:

- The first complete quality run did not pass: unit `137/142`, integration `298/341`, UI `33/34`; typecheck and native `24/24` passed.
- Correctness repairs changed the source after selection, so the selected commit/tree/build identity no longer represents the code that passed the repaired gates.
- No `phase2-test-report.json` was generated for beta.21.

The replacement candidate must use the next monotonically increasing unused beta number and must rerun Plan 02-38 from the beginning on one exact source identity.
