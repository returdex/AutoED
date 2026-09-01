# Phase 2 beta.25 immutable invalidation record

Recorded: 2026-09-02T01:43:00Z

## Disposition

`0.1.0-beta.25` / `v0.1.0-beta.25` is permanently consumed and invalidated. It was assembled, signed, published and anonymously verified before the Plan 02-14 update gate failed closed with `UPDATE_GATE_FRESHNESS_MISMATCH`. The failure exposed a source defect: the verifier required byte-identical availability receipts, including the intentionally volatile `checkedAt`, instead of separately validating a genuinely later fresh observation while holding immutable identity and verification fields exact.

The corrective RED/GREEN commits `348e9f4` and `ef52b6c` change selected source. Therefore beta.25 cannot remain an active update candidate and can never be rebuilt, resigned, relabelled, overwritten or reused. Its public tag, release and assets remain immutable historical data and were not modified or deleted. The next candidate must be the separately selected, fully rerun `0.1.0-beta.26` only if fresh read-only checks continue to prove it unused.

## Selected source and quality identity

| Field | Historical beta.25 value |
|---|---|
| Source commit | `f80ae3b6f7bb5f600e0a0a60b55c61c1a043f804` |
| Source tree | `8e702d1311e26dd26bd4b191a9157a5f29db4772` |
| Build ID | `6c44e404b42e72c8dfb3f1dfef3bb9aa1f5cb95f17de32280019cc23c89c20e5` |
| Source SHA-256 | `24478d9e7d392e538b0037cb4b804c629f0f864b427d585dc2d871f49bec221c` |
| Version-set SHA-256 | `d99d2c596d648d9c7a9dbab9e347f3294623a5e92216ffdc135fab4fce70ad62` |
| Canonical selection SHA-256 | `4a2c250708d02ee19b2e44bd0de215850a08620ad3eac4ff0991702eeec94bae` |
| Canonical test-report SHA-256 | `005c62b326bd13aa0ec62e583858b6377d0405454ca7f846011b9f789e18d51a` |
| Manifest SHA-256 | `c2c1100f338a078fe8682bb05927c2e552973de4acb8977257307179604204a8` |
| Signature SHA-256 | `15bc1af968e0b06b4a193cc6c770e0ae5fbf76ce9e12bc3e74da65f28afe3bb2` |
| Capability-closure SHA-256 | `c1e7ede3907d7fe65de4c416b9d06897aff7dce0c94cd65a1b5441b2e5adb949` |
| External prompt SHA-256 | `13be26d9fe90564e247804b0cfc19da8a30d4b2275aa74c61af756d67227c6cd` |

Historical tracked file-byte SHA-256 values are retained for audit: selection `dcc6e8bce406f352d5b7d6a19a1c3d3ed5c7acec6d37dcdf1f9923aff12d3101`; test report `5e3d23f9d085f4aea57045dabc6cd79ce1b10fae23c5ae9d23e6909cf6d48384`; artifact receipt `111bf67a7e6bb932420db1e5b0def237c4abbee7234b87780baf16f776a67376`; publication receipt `2c28103decadeccc1a52e911e5732f3b0af5d823c0f22edfecef27f60da321d3`; availability receipt `bc6e348b57aeecd5934a4bb86d92848911efe8ca49e21c5eee662ce75d66056f`.

## Preserved public history

Read-only public/direct-remote checks immediately before invalidation confirmed:

- Remote tag `v0.1.0-beta.25` exists and targets `f80ae3b6f7bb5f600e0a0a60b55c61c1a043f804`; no local tag was created.
- Public prerelease ID `380618906` remains published and immutable.
- macOS asset ID `539741564`, `autoed-0.1.0-beta.25-darwin-arm64.tar.gz`, 227,413,903 bytes, SHA-256 `56f141ff2e3d8e054c5cb299bcc7e715e1bd638ac88aa8ce2b867ca4e995d338`.
- Windows asset ID `539741557`, `autoed-0.1.0-beta.25-win32-x64.tar.gz`, 250,419,021 bytes, SHA-256 `579fbdea67e103734842ffe8157f5f5c97e66d8c1bbfec24a2ed006cdc1728ec`.
- No beta.26 local tag, remote tag or public release existed.

This record does not revoke or erase already obtained bytes. It marks them historical and unsupported for the pending update/live gate. Users must not be directed to install or update to beta.25 after this invalidation.

## Active canonical state

The beta.25 selection, test report, signed-artifact receipt, install prompt, publication receipt and availability receipt are removed from the active canonical release surface in the invalidation commit. Their exact prior bytes remain in immutable Git history and the published remote objects remain untouched. No signing, tag, publication, remote mutation, update, login, Profile, school-source or live action occurred during invalidation.
