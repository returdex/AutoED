# Phase 2 beta.46 immutable invalidation record

Recorded: 2026-09-13

## Disposition

`0.1.0-beta.46` / `v0.1.0-beta.46` is permanently consumed and invalidated
during the first formal R3 candidate gate. R2 selected the exact fresh R1
identity once. Managed runtime, typecheck and the complete unit suite passed;
the per-file integration gate then stopped at `two-build-upgrade` with the
sanitized error
`PRE_SOURCE / COMMAND_PROCESS_FAILED_INTEGRATION_TWO_BUILD_UPGRADE`.

The exact file was run independently immediately afterward and passed all 9/9
tests in about 225 seconds. Source, test, tool, artifact and remote state did
not drift, and no owned test process remained. However, the first bounded R3
run retained no allowlisted assertion or environment cause. A passing focused
rerun proves only non-reproduction; it does not identify the required single
environmental transient. Under `.planning/RELEASE-STABILIZATION.md`, ambiguity
forbids retaining the candidate or proceeding to signing/publication.

No beta.46 local or remote tag, GitHub release, public asset, signed candidate
asset, test report, artifact receipt, publication receipt, availability
receipt, installation, update, restart, source login, live evidence, 02-15 or
Phase 3 action exists. beta.46 must never be retried, signed, published or
relabelled.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.46` |
| Tag | `v0.1.0-beta.46` |
| Source commit | `e3d83392b98f5aa607e24a4b8fc0dadc10ef7702` |
| Source tree | `4ea0b77a0b373d3be935490adcd0c558bfd001d7` |
| Build ID | `650c6586b42ee728a21c1b2ed94cdbc34f52db42618c7f03c421deacea35655f` |
| Source SHA-256 | `934ffccb70b7ccc65af20af6c47be6fa486dd6a9e7eb3df1e3ce9df827ebc304` |
| R1 rehearsal SHA-256 | `f0f01b49d04663daff7ca49f2fb5690f2764db183eacc9d93773450f4b490861` |
| R2 selection SHA-256 | `ea6c81c18589b287b510f683c4c50a556276b83ab3fde06263e58da5cb566eab` |

## Corrective boundary

Return to R0 and identify the nondeterministic R3 boundary with bounded,
allowlisted diagnostics that distinguish a source/test failure from an OS,
process, port or runner transient without retaining raw output. Do not weaken
the complete suite, process ownership, cleanup, credential, sensitive-output
or zero-skip rules. Any correction or release-tool change requires a complete
fresh unnumbered R1 before beta.47 may be separately authorized or selected.
Windows native, installation/login/live evidence, 02-15 and Phase 3 remain
blocked.
