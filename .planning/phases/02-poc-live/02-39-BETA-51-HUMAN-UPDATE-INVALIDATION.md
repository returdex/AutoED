# beta.51 human-update invalidation

`0.1.0-beta.51` remains an immutable, availability-proven public release, but
its single real macOS human-update attempt is a permanent `HUMAN_PRODUCT`
failure. The updater completed schema-1-to-schema-2 installation identity
recovery and accepted the exact INSTALL preview. Its bootstrap then exited once
with status 1, `ETIMEDOUT`, and `SIGTERM`; it emitted no completion, readiness,
or cleanup-complete record and was not rerun.

The exact published macOS bootstrap, SHA-bound by the release, contains
`execFileSync(process.execPath, ..., {stdio:'inherit', timeout:300000})` around
the entire interactive installer child. That timer includes both real human
confirmation pauses and every post-confirmation stage. Node therefore sent the
observed SIGTERM when the aggregate five-minute budget expired. A bounded
process-only observation found two beta.51 target API/Worker processes, proving
the attempt reached at least the `started` transition; without reading the
actual managed root, the later journal tip cannot be claimed. The prior report's
“no process remains” statement is not accepted as current evidence.

Corrective R0 removes the aggregate child timeout on both supported bootstrap
paths, preserves bounded internal operations, adds sanitized stage intent/done
and structured error events, and wires interrupted operations to a read-only
signed-current/signed-target/journal-tip scope. Exact `CONTINUE` or `ROLLBACK`
confirmation is single-use and the proof is repeated before mutation. Tests
cover no aggregate human deadline, sanitized process outcomes, explicit cleanup
continuation, post-reopen finalization continuation, activated rollback, stale
preview rejection, and pre-mutation retirement with archive/Profile canaries
retained in synthetic fixtures.

The real managed root and Profile were not read or modified by this diagnosis.
No beta.51 rerun, beta.52 selection, signing, publication, installation, login,
02-15, or Phase 3 action occurred. A complete fresh unnumbered R1 passed on
`b7b49e34…` / tree `32a7169d…` / build `2b7be53a…`, with focused 38, quality
1/154/411/34/24, zero skip/todo, two eight-asset closures, zero sensitive
findings, zero remote mutations, and no rehearsal-owned process. `active update
candidate: none`; beta.52 remains unselected and requires separate authorization.
