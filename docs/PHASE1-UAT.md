# Phase 1 Beta UAT

> **BLOCKED — do not ask the user to run these cases yet.** Plan 10 creates local synthetic A/B delivery evidence only. Plan 12 must establish the real release trust root, Plan 13 must publish and verify obtainable beta artifacts, and the required native Windows ledger must remain `not_run` until it is run on Windows 11.

## Evidence boundary

- Automated fixture A is `0.1.0-beta.1` with `echo`; fixture B is `0.1.0-beta.2` with `echo` and `digest`.
- Fixture signatures use an ephemeral test key that is destroyed. They are not release signatures and must not be published.
- macOS native probes use synthetic local data and a fresh, precisely deleted Keychain canary. No school login, browser Profile, course data, release, tag, or remote is involved.
- Windows artifacts receive static closure, PE machine-header, hash, and link-policy checks on macOS. Native Windows execution remains `not_run`.

## Cases to run only after beta availability passes

1. **Clean installation without Node:** On a clean supported account, obtain the published installer from the verified release location, confirm the previewed root/build/hash, approve only the expected OS prompt, and verify API, Worker, CLI, MCP, and browser identities.
2. **Codex exit:** Start a bounded synthetic self-test, exit Codex, reopen it, and verify the independently owned API and Worker remained healthy while the old MCP host is reported accurately until reloaded.
3. **Manual update:** Install the earlier published beta, verify `echo` and the expected `digest` rejection, run the prompted update, reload the host client when instructed, then verify `echo` and the known SHA-256 `digest` result from the installed entry.
4. **Status UI:** Use keyboard-only navigation at 320 CSS pixels and 200% zoom. Verify focus, stale/unknown language, old-install inventory language, manifest evidence, and that refresh does not create a job.
5. **OS authorization denial:** Deny an expected permission. Verify the installer stops with a recovery action, preserves data and exact recovery receipts, and does not claim success.
6. **Rollback and cleanup:** Inject an approved synthetic migration/cleanup failure. Verify rollback only when the signed old artifact, snapshot, generation, processes, and write boundary are proven; otherwise verify `human_needed`/`cleanup_pending`, retained archives, and no broad process kill.

Record macOS and native Windows results separately with OS version, architecture, artifact hash, build identity, result code, and cleanup outcome. A Windows result may never be filled from macOS static analysis, WSL, or a fixture.
