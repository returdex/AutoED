# Phase 2 beta.23 invalidation

Status: `invalidated`

The immutable selection `0.1.0-beta.23` / `v0.1.0-beta.23` is permanently excluded from Phase 2 release use. Its original selection receipt remains preserved in Git commit `7be8c8f`; its original complete test report remains preserved in Git commit `94d458d`. Neither receipt may be restored as the active canonical selection/report or used to create a Phase 2 artifact, tag, release, publication receipt, availability receipt, update handoff, or live evidence.

Invalidated selected identity:

- Source commit: `1c614bfeac4f7e0d83de66764ccecaf8ef916946`
- Source tree: `e84d877310fe830bc4d721bbc7c304190703f021`
- Build ID: `ee2e76977d864622c72a85cd225ad05264b11b774e1be628338dd833d404d981`
- Source SHA-256: `a1bfd710c84aea182d1e255b333c58195183bdf4f6e62c890887a7961ca099df`
- Selection SHA-256: `20dca3e5731de361bde503e1f84a5b72d68730768549dbd8378b09af6043db07`
- Test-report SHA-256: `046cdbfef774a8cbe944761c10e517c3e13e3f3d903813fc2583455937459218`

Invalidation basis:

- Deterministic Plan 02-39 assembly exposed a false-positive privacy rejection: legitimate declared production dependency package segments named `cookie` were treated as runtime credential artifacts.
- Corrective RED commit `ab833b2` proves the three required production dependency paths must pass while `runtime/Profile`, `runtime/Cookie`, and `runtime/Cookies` remain rejected.
- Corrective GREEN commit `2958d61` implements only that semantic package-path distinction. The beta.23 commit/tree/build/source identity therefore no longer represents the corrected source that must be assembled.
- The prior beta.23 quality results are historical evidence for the old selected source only and are not reused for the replacement candidate.

Consumption check performed before invalidation:

- The public repository remains `returdex/AutoED` with repository ID `1350421724`.
- Unauthenticated GitHub release/tag observations and direct remote-tag observation ended at published `0.1.0-beta.20`; neither beta.23 nor beta.24 existed as a public, local, or direct-remote tag/release/asset.
- No `release/phase2-beta-artifacts.json`, `release/phase2-install-prompt.md`, `release/phase2-publication.json`, or `release/phase2-availability.json` existed. Assembly stopped before Keychain access, signing, receipt creation, tag, publication, update or live work.

The replacement candidate must use the next monotonically increasing unused beta number and rerun all Plan 02-38 quality and sensitive-scan gates from the beginning on one exact corrected source identity.
