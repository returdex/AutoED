# Phase 2 beta.22 invalidation

Status: `invalidated`

The immutable selection `0.1.0-beta.22` / `v0.1.0-beta.22` is permanently excluded from Phase 2 release use. Its original selection receipt remains preserved in Git commit `8020043`; its original complete test report remains preserved in Git commit `916bcc8`. Neither receipt may be restored as the active canonical selection/report or used to create a Phase 2 artifact, tag, release, publication receipt, availability receipt, update handoff, or live evidence.

Public identity:

- Source commit: `4e3f81e45e3d7b8bf4199454e284124ba97456fd`
- Source tree: `f5554b6a9686eabfaa12591311882dcc9d1846a7`
- Build ID: `12ef9f1eeefbb00add0c94c2d58bbd4c2943853d585227d8d02ab8d71cd5a407`
- Source SHA-256: `1184a96196557d3c2c3bf274f0253068118a6fdcaacb60278bdc34beb37f65dc`
- Selection SHA-256: `7894baf2e96bc00242a433a19851feb70711b6c0a7f569c9b51229db577c2f1a`
- Test-report SHA-256: `cd66a50d4a80e30a15e648c7cfc96d4233a19ab9ab361b00b8af894939ce85d8`

Invalidation basis:

- After beta.22 selection and quality binding, the user explicitly approved the two-layer install-prompt contract.
- Corrective RED commit `3771e77` and GREEN commit `eb2843d` changed selected release source, tests, assembly and verification behavior. The beta.22 commit/tree/build/source identity therefore no longer represents the approved source that must be assembled.
- The prior beta.22 quality results are historical evidence for the old selected source only. They are not reused for the replacement candidate.

Consumption check performed before invalidation:

- The public repository remains `returdex/AutoED` with repository ID `1350421724`.
- Unauthenticated GitHub release/tag observations and direct remote-tag observation ended at published `0.1.0-beta.20`; neither `0.1.0-beta.22` nor `v0.1.0-beta.22` existed as a public or remote tag/release/asset.
- Local tags also ended at `0.1.0-beta.20`; no local beta.22 tag or fetched remote beta.22 ref existed.
- No `release/phase2-beta-artifacts.json`, `release/phase2-install-prompt.md`, `release/phase2-publication.json`, or `release/phase2-availability.json` existed. Plan 02-39 had stopped before Keychain access, signing, assembly receipt, tag, publication, update or live work.

The replacement candidate must use the next monotonically increasing unused beta number and rerun all Plan 02-38 quality and sensitive-scan gates from the beginning on one exact corrected source identity.
