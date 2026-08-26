# Release Safety and Trust Boundary

AutoED beta publication is blocked until Plan 12 establishes the first approved public trust root and isolated `returdex` GitHub authorization, and Plan 13 provides a version-specific publication receipt. Plan 11 creates tools and fixtures only. It does not create a repository, key, tag, release, asset, remote, or authenticated session.

## Required preflight

1. Verify repo-local Git author and committer are `returdex` with the approved `returdex@users.noreply.github.com` identity. This is separate from GitHub authentication.
2. Verify the isolated GitHub configuration reports login `returdex`. Do not switch a global account or print a token.
3. Query `returdex/AutoED`. An existing repository is a hard conflict unless its protected Plan 12 creation receipt matches exactly; never adopt a same-name or legacy repository.
4. Require the unmodified PolyForm Noncommercial 1.0.0 `LICENSE` and `LICENSING.md`. Commercial use requires separate authorization.
5. Scan every public package file and every blob reachable from the exact tree to be pushed. `.gitignore` and deletion from the current tree do not clear historical material. A suspected secret, Profile, database/WAL, log, private fixture, runtime data, or private key stops publication; do not rewrite history automatically.
6. Require a new `0.1.0-beta.N`. Existing tags or assets are immutable and must never be overwritten.
7. Require complete per-target manifests, hashes, sizes, dependency provenance, and test ledgers. Windows native `not_run` may remain visible for an early beta but prevents claiming Phase 1 or cross-platform acceptance.

## Stop conditions

Stop on wrong account, insufficient permissions, repository conflict, locked release key, license drift, source/package scan failure, existing version/asset, OS protection warning, or any unknown result. Report only a sanitized code and next action. Never log credentials, tokens, private keys, environment contents, or suspicious source bytes.

## Availability before UAT

After Plan 13 publication, use an unauthenticated fresh client to download every public manifest, signature, bootstrap, source, and platform artifact in full. Refuse redirects, validate content length, SHA-256, signature, exact manifest closure, and build identity, and write the version-bound availability record. An HTTP 200 response, local file, authenticated cache, or HEAD request is not availability evidence. Human update/UAT instructions remain blocked until this record passes.

Two immutable synthetic betas must be obtainable before the manual earlier-to-later update case. Publication is distribution evidence only; it is not a school login, native Windows pass, host reload, or product UAT result.
