# Phase 2 beta.28 immutable invalidation record

Recorded: 2026-09-02T02:28:30Z

## Disposition

`0.1.0-beta.28` / `v0.1.0-beta.28` is permanently consumed and invalidated. Managed Node 24 typecheck and all 143 unit tests passed. The corrected availability-freshness paths also passed in the complete integration run. However, the suite failed closed after 348 of 349 tests when the `client-wiring.test.ts` stdio negative encountered `PROCESS_OBSERVATION_UNAVAILABLE` while its owned-process fixture was stopping.

A focused rerun of that exact test passed 1/1 without source changes, confirming a transient OS process-observation failure rather than a product or freshness-contract regression. Plan 02-38 nevertheless forbids reusing beta.28 or any partial result after a failed selected-source gate. No beta.28 report, signing, archive, tag, release, asset, publication, update or live action was created.

## Consumed identity

| Field | Value |
|---|---|
| Source commit | `177124b62acdf2679541a516b8b73a7c789e6359` |
| Source tree | `c638471d91b88e5099dbf3973e8f85e7da884e48` |
| Build ID | `a79c1d9d5b0f18e0ce5d210ad242c0025b1fcb56bfeeebec96eb6899490d4bdc` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Version-set SHA-256 | `41f2531102e6d56f1875e557824b9032a3eb5e9e11b8e97b2618ed86ae94b355` |
| Canonical selection SHA-256 | `acb978cf7b857a3b5b6e740472b79716a9dcd45ecbd7a2645c21a3d58749507e` |
| Selection file-byte SHA-256 | `3350b354504b1ccbb025a510157d466d76138233ff42b96819434dc31c25b5a1` |

Read-only checks confirmed beta.29 had no local tag, direct-remote tag or public release before this invalidation. The beta.28 selection is removed from the active canonical release surface in this commit; its exact bytes and sanitized failure record remain in Git history. No existing service was stopped or changed.
