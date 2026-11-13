# Architecture and control map

## Trust boundaries

```
dispatcher (write on THIS repo) ──dispatch──▶ preflight job ──(no secrets, no env)──▶ staging job [environment: civicofhome-staging]
                                              format + env   ──▶ PAUSED until required        │
                                              assertion            reviewer (≠dispatcher)    ▼
                                                                                 env secrets + App token
                                                                                         │
                                                                                         ▼
                                                              kaplesh8/easy-ui-bliss @ <immutable input SHA>
                                                              (checked out read-only, token scope: read)
```

Boundary rules:

* **Pre-approval / post-approval separation.** The `preflight` job runs with the repository `GITHUB_TOKEN` limited to `contents: read` + `actions: read` and has **no** access to environment secrets. All input-format checks and the environment-protection assertion happen here. If the environment is absent, lacks required reviewers, allows admin bypass, or lacks a deployment-branch policy, the workflow exits before a reviewer is ever prompted.
* **Approval gate.** The `staging` job declares `environment: civicofhome-staging`. GitHub pauses it until a required reviewer approves. Self-review is disabled (`prevent_self_review`). Administrators never bypass (`can_admins_bypass == false`, asserted in-run).
* **Least privilege token.** `actions/create-github-app-token` mints a per-run installation token scoped to `kaplesh8/easy-ui-bliss` only, with `contents: read`, `commit-statuses: read`, `metadata: read`. No write permission, no other repositories, short-lived.
* **Immutability.** The product SHA is a mandatory input, re-checked as full lowercase-hex. The gate never checks out `main` or any branch; `ci/circleci: verify` must be green at that exact SHA.
* **No ambient credentials.** The only secrets used are the five environment secrets listed in `docs/OPERATOR_SETUP.md`; none are repo-level, none are printed, none are visible to the preflight job.

## Control map (threat → control → location)

| # | Threat | Control | Location |
|---|--------|---------|----------|
| T1 | Malicious/garbage dispatch input | Strict format validation, fail-closed CLI | `gate/validate-inputs.mjs` |
| T2 | Reviewer bypass of the environment | Required reviewers + `prevent_self_review` + `can_admins_bypass=false` + deployment-branch policy; asserted **before** secrets exist | workflow preflight + OPERATOR_SETUP §3 |
| T3 | Admin force-merge around review | Branch protection on this repo: PR required incl. admins; no force-push/delete | OPERATOR_SETUP §2 |
| T4 | Token with write scope | App installation token: read-only permissions only | workflow staging job |
| T5 | Applying migrations to an unverified build | Green `ci/circleci: verify` required at the exact SHA | workflow staging job |
| T6 | Schema drift / tampered migrations | SHA-256 manifest verification pre-apply; identity preflight before EACH migration | workflow staging job |
| T7 | Wrong project (production) touched | `SUPABASE_PRODUCTION_PROJECT_REF` used only for inequality; DB URL parsed + compared to staging ref immediately before **each** migration; exact confirmation phrase | product `scripts/prs-staging-identity.mjs`, `prs-staging-db-identity.sh` |
| T8 | Secret in logs | No echoing; redaction-by-construction; `if: always()` secret-leak scan that fails closed | workflow secret-scan step |
| T9 | Silent partial failure | `ON_ERROR_STOP=1` per migration, all-or-nothing migration transactions (WF-13); probes gate the handoff; artefacts 90-day | workflow; product migrations |
| T10 | "Green" run mistaken for RLS/AAL2 assurance | Explicit non-claims in every document and in the handoff job | README, OPERATOR_SETUP §7 |
| T11 | Backup/restore unproven | PITR input is an explicit, redacted operator ATTESTATION; rollback runbook mandatory | OPERATOR_SETUP §4/§8 |
| T12 | Repo impersonation / supply chain | Product repo pinned by constant; all actions pinned by full commit SHA | `gate/validate-inputs.mjs`, workflow |

## What is proven vs not proven

Proven machine-checkable: input format, environment protection posture (asserted pre-approval), commit status, manifest hashes, DB host/db identity inequality, audit-probe denial outputs, absence of leaked secrets in logs.

**Not proven and not claimed:** availability/completeness of Supabase PITR, correctness of RLS policies under live auth traffic, AAL2 enforcement, storage signed-URL enforcement, or the absence of application-level authorization bugs. Those are the manual matrix in `docs/OPERATOR_SETUP.md` §7. **Production remains NO-GO regardless of gate state.**
