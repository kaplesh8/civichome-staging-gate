# TEST EXECUTION REPORT — CivicHome Staging Gate (2026-11-10/11, Phase 7.4)

**Environment:** Arena sandbox (Linux, Node v22.22.3, Python 3.11.2 + ephemeral venv for PyYAML)
**Product repo:** kaplesh8/easy-ui-bliss @ 7083f76cab2725b723300acfabbff90792e626bb (branch arena/08c686c4-easy-ui-bliss, clean; includes and descends from required baseline 41ca65c)
**Gate repo:** kaplesh8/civichome-staging-gate — LOCAL branch "phase-7.4-gate-reconstruction" (fresh reconstruction from authoritative product docs; NOT the lost 95eeac7; see report §provenance)

## Executed this pass (Phase 7.4)

| # | Command | Result |
|---|---------|--------|
| T1 | node --test gate/validate-inputs.test.mjs | **7/7 PASS** |
| T2 | node --test gate/wf-conformance.test.mjs | **16/16 PASS** (15 conformance + 15 negative twins in one suite; runAll asserts 15/15 WF checks) |
| T3 | node --test (both files) | **23/23 PASS, exit 0** |
| T4 | Workflow YAML parse (PyYAML safe_load) | **PASS** (jobs preflight,staging,handoff; triggers workflow_dispatch only; env on staging+handoff only) |
| T5 | Embedded run-scripts "bash -n" | **12/12 PASS** |
| T6 | sha256sum -c MANIFEST.sha256 | **11/11 files OK** |
| T7 | Credential-pattern scan of the tree (private keys / URLs with inline passwords) | **0 matches** |
| T8 | Product repo migration manifest verifier ("where source material is available") | **PASS 2/2** (executed at 41ca65c in Phase 7.3 and again at this pass per current tip contents) |
| T9 | Remote probes (read-only): repo identity, branches, commits, tree, environments, protection endpoint | executed — see report; main = 5fbd9b4 (placeholder README only) |
| T10 | CircleCI ci/circleci: verify (read-only) at session tip | expected SUCCESS at 7083f76 — re-check after push; last recorded SUCCESS at 41ca65c and 41ca65c→7083f76 docs-only delta |

## NOT executed (honest label)

| Item | Reason |
|------|--------|
| Any gate dispatch / live approval / positive or negative live test | Requires owner completion of OPERATOR_SETUP (environment, App, secrets, independent reviewer) — not authorised this pass |
| Product vitest suite | node_modules absent in sandbox snapshot; bun not installed; lockfile is bun.lock |
| Fresh-clone re-verification | Blocked unless/until the authorised feature-branch push succeeds (Phase 5 conditional) |

## What passes here prove / do not prove

Proves: input rejection coverage; every WF control present with a falsifying mutation twin; workflow parses; embedded bash is syntactically valid; all action pins are full-length SHAs; tree has no credential patterns; manifest hashes match.
Does NOT prove: runtime behaviour on a live Supabase project, approval-record correctness (organisational), PITR availability, or any RLS/AAL2/storage property. Unexecuted = unproven.
