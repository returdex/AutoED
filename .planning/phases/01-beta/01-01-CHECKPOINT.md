# Plan 01-01 — additional verifier approval required

Date: 2026-08-27. Status: user approved amendment; resume execution. Tasks completed at checkpoint: 0/3.

## Observed preflight

- Official Node index confirms v24.20.0, npm11.19.0, darwin-arm64 and win-x64 artifacts. Signed checksum files are obtainable.
- Executor rechecked all eleven exact npm version endpoints: HTTP 200.
- Host macOS26.5.2 arm64 has Node26.0.0; no gpg/gpgv found on PATH or standard Homebrew/MacGPG paths.
- No implementation files, runtime binaries or dependencies have been installed; no school, private data or remote repository operation.

## Blocking reason

The approved bootstrap requires verification of Node's signed checksum list before executing downloaded Node. The required verifier is absent. A checksum-only fallback or a custom OpenPGP implementation does not satisfy this requirement.

## Approved amendment

The user explicitly replied “批准” after clarification that this is local verification only, not publication to Node.js or npm. Authorization is limited to the pinned bootstrap-only OpenPGP.js approach below; no global GPG installation is approved.

Add OpenPGP.js `openpgp@6.3.1` only to an isolated development bootstrap verifier under `.runtime/dev-toolchain/verifier/`. The npm registry currently lists Node>=18, no dependencies, LGPL-3.0+, and this exact tarball integrity:

`sha512-7oSPvmlKPojxFoyelT5DWPIAVmqWZh4qU/5pO6bdoShEtRpCw9Sye9IXUQj6EFM3XpgGssqccAr705YtTcLNQw==`

Before execution, review the pinned official package/API and security advisories, verify exact package integrity, disable package install scripts, and use the existing host Node solely to run this bootstrap verifier. Pin Node official release-key fingerprints against official release-key sources; enforce a valid signature over the exact checksum bytes and then the artifact hash. Negative tests must reject wrong keys, changed checksums and changed archives. Do not weaken verification on failure.

This adds a reviewed third-party bootstrap dependency, not a product runtime dependency. Preserve its license notice locally; do not include it in beta artifacts or alter the product license. No global GPG/Node installation, no system PATH changes and no private keys are required. The product's no-Node end-user installation path remains the approved separate Plan 08 design.

Alternative: separately approve an isolated GPG distribution and its dependencies after official-source review. Do not install either option without the user's response.

## Resume

Resume Plan 01 task01-1 with the approved amendment, verify provenance and implement all three tasks; do not mark this checkpoint or package metadata as runtime validation. Other Phase1 plans retain their existing approval, but dependent plans cannot start before01-01 succeeds.

Sources: https://nodejs.org/dist/index.json ; https://github.com/nodejs/release-keys#verifying-release-packages ; https://registry.npmjs.org/openpgp/6.3.1 ; https://github.com/openpgpjs/openpgpjs .
