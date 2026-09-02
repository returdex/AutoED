# Phase 2 beta.32 immutable invalidation record

Recorded: 2026-09-02T10:25:00Z

## Disposition

`0.1.0-beta.32` was selected locally but never tagged, published, signed into canonical artifacts or shown to the user. It is permanently consumed because the first R3 build ran from repository HEAD `7372fe5…`, while the immutable selection and rehearsal were bound to `fe54a6e…`. The observed build ID `f8c8ea6d…` therefore did not equal selected build ID `8b90e635…`.

This is `POST_SOURCE / SELECTION_CHECKOUT_DRIFT`: planning evidence was committed between the rehearsal source and selection, but the candidate writer did not require the selected commit/tree/source to equal the active checkout. No product test failed, no remote object exists and no installation, login, Profile or school access occurred. The identity is nevertheless not reusable because changing its selected commit would violate immutability.

The correction must make candidate selection fail unless the exact rehearsed source is the current checkout. Rehearsal attestations and candidate receipts remain uncommitted planning/release outputs until after selection so the source HEAD cannot move between R1 and R2.

## Consumed identity

| Field | Value |
|---|---|
| Version / tag | `0.1.0-beta.32` / `v0.1.0-beta.32` |
| Selected source commit | `fe54a6eca96873ae5306c4380a77adccfe69dd5c` |
| Selected source tree | `920db9e470f03ef3cdf34e480cedd45e1ee6cef1` |
| Selected build ID | `8b90e635937fddebf4eb921428a825af4f99f24f404ebcb78f8658bcd8c2a4af` |
| Selection SHA-256 | `b6a2914fb63415122ec5f7a837164a059349cda7f1f022fe0fdd97eaedbe376d` |
| Rehearsal SHA-256 | `a8f0e55e4a1f6bd67caa4746b30304ff467d79d9eda1afa6661be1ab9e107a84` |
| R3 checkout build ID | `f8c8ea6d6a6a8503b333fa90c79f24487f4d6c5d049872359dd9246ca6f053ec` |

The beta.32 selection is removed from the active canonical surface. Its exact bytes remain in Git history once this invalidation is committed; no remote mutation is required.
