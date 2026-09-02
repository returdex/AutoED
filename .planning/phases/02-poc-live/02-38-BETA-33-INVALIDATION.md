# Phase 2 beta.33 immutable invalidation record

Recorded: 2026-09-02T11:40:00Z

## Disposition

`0.1.0-beta.33` was selected locally and its exact build identity matched the R1 rehearsal, but R3 did not converge. It was never tagged, published, signed into canonical artifacts, installed or shown to the user and is permanently consumed.

The first complete R3 integration run had one `LOCAL_VOLUME_UNCONFIRMED_PREVIEW_INTENT` failure in `managed-cleanup`; an immediate focused rerun passed. Under the allowed `POST_TRANSIENT` retention rule, beta.33 then required two consecutive complete gates. The first complete gate passed typecheck, 143 unit, 358 integration, 34 UI and 24 native tests. The second complete gate failed in `upgrade-recovery` with `HUMAN_RECOVERY_REQUIRED`. Recurrence at a different process/host observation boundary invalidates the candidate even though source, tests and canonical artifacts did not drift.

No beta.34 may be selected until a new R0/R1 cycle addresses test-run process isolation, stale synthetic-runtime detection and bounded host/mount observation without weakening the product's fail-closed behavior.

## Consumed identity

| Field | Value |
|---|---|
| Version / tag | `0.1.0-beta.33` / `v0.1.0-beta.33` |
| Source commit | `51258001396d58c97cb35ce393123c3675fb4d95` |
| Source tree | `6aee0444ad28789b615e22ee5d1a599299b9e0bb` |
| Build ID | `c116087e521249ce4858d1a9f993dd30b961d86a539a0342da32f70506623748` |
| Source SHA-256 | `d042eb351218a06424b33027bf9430b853b5ff79def33980e8dc4a43d0d976d1` |
| Selection SHA-256 | `eaf336ff96db610a3d7ed692e46da6c4c64e1953bbf6765a1055bc7a8a469e3b` |
| Rehearsal SHA-256 | `d0a27d691af8d8f3ae23bc64dde9fdbc831a3204ce6684f01f828b02e529bebc` |

The beta.33 selection is removed from the active canonical surface. No remote object exists and no remote mutation is required.
