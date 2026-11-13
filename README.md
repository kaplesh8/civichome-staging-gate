# CivicHome Staging Gate

The **only** authorised CI path to the CivicHome PRS **staging** database. Designed under `kaplesh8/easy-ui-bliss` (`docs/prs/PRS_STAGING_INTEGRATION_CHECKLIST.md`, WF-15 ADR `PRS_WF15_ARCHITECTURE_DECISION_2026-11-10.md`, threat model `PRS_THREAT_MODEL_STAGING_GATE_2026-11-10.md`) and implemented here as a separate, public, least-privilege repository.

## What this is

A GitHub Actions `workflow_dispatch` workflow that — and nothing else:

1. validates dispatch inputs (format only, pre-approval, no secrets),
2. asserts the `civicofhome-staging` environment exists with required reviewers and administrator-bypass disabled — **fails closed otherwise**,
3. waits for an independent required-reviewer approval on the deployment (never the dispatcher),
4. mints a short-lived GitHub App installation token with exactly **Contents: Read + Commit statuses: Read** (+ Metadata: Read) on `kaplesh8/easy-ui-bliss` only — **no write permission of any kind**,
5. checks out the product repository at the immutable input SHA,
6. requires a green `ci/circleci: verify` commit status on that exact SHA,
7. re-verifies the pinned migration manifest (SHA-256),
8. applies migrations in manifest order, running the DB identity preflight **immediately before each migration**,
9. runs post-apply static checks (≥7 PASS, 0 FAIL), the audit immutability probe (≥3 PASS, 0 FAIL/CHECK), and a secret-leak scan of all logs (`if: always()`),
10. hands off to the manual RLS/AAL2/storage matrix — it does **not** verify those and never claims to.

## What this is NOT

* Not a production path. There is no production credential anywhere in this design and it refuses to add one.
* Not an auto-merge / deploy / release mechanism. It never touches PRs, branches, environments other than `civicofhome-staging`, or any other repository.
* Not evidence that RLS/AAL2/storage are enforced — see `docs/OPERATOR_SETUP.md` §7.

## Status

**Prepared, tested offline (23/23 PASS), not yet proven end-to-end.** The operator steps in `docs/OPERATOR_SETUP.md` must be completed before the first dispatch. Until then no staging migration may be applied through this gate. Live steps (approval, dispatch, migrations) remain **UNEXECUTED** and are honestly labelled as such.

## Layout

* `.github/workflows/staging-integration.yml` — the gate workflow
* `gate/validate-inputs.mjs` — pre-approval input validator (pure, offline, fail-closed)
* `gate/validate-inputs.test.mjs` — original seven validator tests
* `gate/wf-conformance.mjs` — WF-01…WF-15 structural/behavioural conformance checks
* `gate/wf-conformance.test.mjs` — positive + negative twin tests
* `docs/ARCHITECTURE.md` — threat model and control map
* `docs/SECURITY.md` — secrets, scopes, reporting
* `docs/OPERATOR_SETUP.md` — the owner-run source of truth (setup → dispatch → rollback, §0–§9)
* `docs/WF_TRACEABILITY_MATRIX.md` — WF-01…WF-15 → control → test → evidence
* `docs/TEST_EXECUTION_REPORT.md` — what was actually executed, with outputs
* `MANIFEST.sha256` — SHA-256 manifest of the release tree
