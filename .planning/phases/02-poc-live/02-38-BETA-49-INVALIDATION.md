# Phase 2 beta.49 immutable invalidation record

Recorded: 2026-09-14

## Disposition

`0.1.0-beta.49` / `v0.1.0-beta.49` is permanently consumed and invalidated
before candidate assembly. R2 selected the exact fresh R1 source once, and the
complete formal R3 candidate gate passed under the managed runtime with
typecheck 1, unit 154, integration 401, UI 34 and native 24; every suite had
zero skip/todo and the four-surface sensitive scan had zero findings.

The first and only formal R4 invocation stopped before build, Keychain signing
or artifact creation with `PHASE2_ASSEMBLY_OUTPUT_EXISTS`. Bounded read-only
diagnosis proved that the beta.48 invalidation commit retired selection, test,
artifact, publication and availability pointers but accidentally retained the
tracked beta.48 `release/phase2-install-prompt.md`. The R1 snapshot contract
proved only that the receipt set was unchanged; it did not require every stale
active release pointer, including the prompt, to be absent. R4 correctly
refused the pre-existing prompt before any candidate mutation.

This is deterministic release-state/source-contract drift, not a proven
environmental transient. Removing the prompt or changing the R1 contract after
R2 would violate the frozen candidate boundary. beta.49 must therefore never
be retried, signed, published, tagged or relabelled. No beta.49 local/remote
tag, GitHub release, signed artifact, public asset, publication receipt,
availability receipt, installation, login or live action exists. The active
selection and test-report paths are retired; their exact sanitized evidence is
preserved outside Git for diagnosis.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.49` |
| Tag | `v0.1.0-beta.49` |
| Source commit | `78db7570e64f9f1fd18712becd588b6007bf7559` |
| Source tree | `bc08b986e2a5d0caa96c5b0793c3bc282c2780a3` |
| Build ID | `5ad0e07a8dc1c1df45a85017eadb3374552a7e7b64b8b1fa56b935e540e04dd9` |
| Source SHA-256 | `45e75bf1ee9efccfb63f0d2507fce97a29c6a78d652ca69119328f40cf011c35` |
| R1 rehearsal SHA-256 | `979b65d10bf88ecf6f293c3fd915fd2157590a2ea1ab97914b495e33a7fbfaaa` |
| R2 selection SHA-256 | `3a7ae96f9111402fcf7f34772dbde0632cf7288529fe72efb7e3f3c97f765d5c` |
| R3 test-report SHA-256 | `d6d3a7ac6ba01efa94de9d5cdd8c2ab178b4b97aa5228aafdeb79554c7a96eff` |

## Corrective boundary

Return to bounded R0. Retire the stale beta.48 install-prompt pointer and make
the unnumbered R1 initial/final snapshot reject every active R2–R5 pointer,
including an install prompt, rather than merely proving that stale state stayed
unchanged. Add a focused regression for this exact omission, then complete a
fresh unnumbered R1 on the corrective commit. A later beta requires separate
authorization; do not select beta.50 during this corrective work. Installation,
login, Windows/live evidence, 02-15 and Phase 3 remain blocked.
