---
phase: 02-poc-live
plan: 02-38
status: invalidated
version: 0.1.0-beta.36
class: POST_TRANSIENT
code: HUMAN_RECOVERY_REQUIRED_PROCESS_STOP_UNCONFIRMED
---

# Beta.36 invalidation

Beta.36 passed R0/R1 and was selected once. Its first complete candidate gate failed in `upgrade-recovery` with `HUMAN_RECOVERY_REQUIRED_PROCESS_STOP_UNCONFIRMED`; the focused eight-test file then passed, identifying a transient process-stop observation boundary. A required fresh complete gate subsequently passed all other tests, but the next complete gate reproduced the same code in a different recovery scenario.

The recurrence violates the two-consecutive-complete-pass retention rule, so beta.36 is permanently consumed. No signing, public tag, release, asset, canonical receipt, installation, OS approval, restart, login, school access or live evidence occurred. The selection and test report are removed; no candidate output may be reused.

Return to R0/R1 and repair the process-stop observation boundary before assigning beta.37.
