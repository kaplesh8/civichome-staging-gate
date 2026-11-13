# OPERATOR SETUP — owner runbook for the CivicHome staging gate

**Audience:** the repository owner (kaplesh8) and the independent reviewer.
**Status:** the repository is prepared and offline-tested. The live path is **UNEXECUTED** until you complete every step in order. Do not dispatch before §6 passes, and never treat any §5 run as production-readiness evidence — see the non-claims throughout.

Today is 2026-11-10. All commands assume `gh` authenticated as the owner.

---

## 0. Preconditions

* You own `kaplesh8/easy-ui-bliss` with a green `ci/circleci: verify` at the exact SHA you intend to apply.
* The product tree contains `scripts/prs-staging-identity.mjs`, `scripts/prs-staging-db-identity.sh`, `scripts/prs-migration-manifest.mjs`, `scripts/prs-secret-scan.mjs`, `docs/prs/staging/01_post_apply_static_checks.sql`, `docs/prs/staging/02_audit_immutability_probe.sql` at that SHA. The gate fails closed if any are missing or tampered.
* You have a rehearsed Supabase Point-In-Time-Recovery (or equivalent) restore for staging. The gate records your **attestation**; it cannot verify PITR exists.

## 1. Push this repository

```bash
git remote add origin https://github.com/kaplesh8/civichome-staging-gate.git
git push -u origin main          # or open a PR from your feature branch first (recommended) and merge it
git rev-parse origin/main        # must equal the reviewed release commit
```

Merging/pushing by hand is an owner act; this runbook never automates it. Confirm the release tree before trusting it: `node --test gate/validate-inputs.test.mjs gate/wf-conformance.test.mjs` → expect 23/23 PASS, and `sha256sum -c MANIFEST.sha256` → expect all OK.

## 2. Protect `main`

Ruleset or branch protection on `main` requiring **all** of: pull request before merging; ≥1 approving review; dismiss stale approvals; **Include administrators**; **block force pushes**; **block deletions**.

```bash
gh api -X PUT repos/kaplesh8/civichome-staging-gate/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "require_code_owner_reviews": false, "required_approving_review_count": 1 },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

Verify: `gh api repos/kaplesh8/civichome-staging-gate/branches/main/protection` — `enforce_admins.enabled == true`, `allow_force_pushes`/`allow_deletions` false.

## 3. Create the environment `civicofhome-staging`

GitHub → **Settings → Environments → New environment** named exactly `civicofhome-staging`.

* Required reviewers: the **independent reviewer** (a real second person, never the dispatcher). Enable **prevent self-review**.
* Deployment branches: **Selected branches → `main` only**.
* **Administrator bypass: DISABLED.**

Verify (this is also the assertion the workflow runs pre-approval):

```bash
gh api repos/kaplesh8/civichome-staging-gate/environments
```

Expect `can_admins_bypass == false`, a `required_reviewers` rule with ≥1 reviewer, and a `deployment_branch_policy`. Missing any ⇒ the workflow (correctly) refuses to run.

## 4. Create the least-privilege GitHub App

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**.

* Name: `CivicHome Staging Gate` (or record your choice).
* **Webhook: disabled.**
* Repository permissions — exactly: **Contents: Read-only**, **Commit statuses: Read-only** (+ Metadata: Read-only, implicit). Everything else: **No access**.
* Account permissions: none. Installation scope: **only this account** (or selected repositories — never org-wide).

Then: note the **App ID**; generate a **private key** (.pem); **Install** the App on `kaplesh8/easy-ui-bliss` **only**; never on this gate repository.

## 5. Set the five environment secrets

In **this repository → Settings → Environments → civicofhome-staging → Add secret** (values never appear in files, tickets, or chat):

| Secret | Value |
|--------|-------|
| `APP_ID` | numeric App ID from §4 |
| `APP_PRIVATE_KEY` | full PEM contents from §4 |
| `SUPABASE_STAGING_PROJECT_REF` | 20-char staging project ref |
| `SUPABASE_PRODUCTION_PROJECT_REF` | 20-char production project ref (inequality proof only) |
| `SUPABASE_STAGING_DB_URL` | `postgresql://postgres.<ref>:<password>@...pooler.../postgres` for **staging** |

Confirmation shows names only:

```bash
gh api repos/kaplesh8/civichome-staging-gate/environments/civicofhome-staging/secrets --jq '.secrets[].name'
```

## 6. Negative dispatch test (BEFORE any positive run)

```bash
gh workflow run staging-integration.yml --repo kaplesh8/civichome-staging-gate \
  -f product_sha=<SHA with green verify> \
  -f staging_project_ref=<staging ref> \
  -f pitr_restore_point="PITR ok <ISO8601> project <ref> snapshot <id>; restore rehearsed <date>; approved by <name>" \
  -f confirm_not_production=STAGING-NOT-PRODUCTION
```

Expected: `preflight` PASSES; `staging` shows **Waiting for review** and executes **nothing** until the independent reviewer approves in the UI.

Verify the approval record before/after approving:

```bash
RUN_ID=$(gh run list --repo kaplesh8/civichome-staging-gate --workflow staging-integration.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh api repos/kaplesh8/civichome-staging-gate/actions/runs/$RUN_ID/approvals
```

If `preflight` fails, fix §3 — never weaken the workflow.

## 7. Manual matrix — REQUIRED after any approved run

A green gate run **does not** verify: authenticated RLS traffic, role escalation, AAL2, storage signed-URL enforcement, malware E2E, Playwright against staging, or email delivery. Execute **every** item in the product repository's `docs/prs/PRS_STAGING_EXECUTION_PACK_2026-11-10.md` §5–§12 against staging and attach results to the release dossier. Any unsigned box blocks promotion discussion.

## 8. Rollback and incident response

* **Post-approval migration failure:** the workflow halts (`ON_ERROR_STOP`). Do **not** re-run to push through. **PITR-first:** restore staging to the rehearsed snapshot from §0, then investigate. If PITR is unavailable, escalate — never hand-edit schema to force green.
* **Suspected secret exposure:** (1) revoke the App private key in Developer settings; (2) set a new one (`gh secret set APP_PRIVATE_KEY --env civicofhome-staging --repo kaplesh8/civichome-staging-gate`); (3) rotate the staging DB password in Supabase and update `SUPABASE_STAGING_DB_URL`; (4) audit runs `gh run list --repo kaplesh8/civichome-staging-gate --limit 20`; (5) confirm no production credential ever existed here by listing secret NAMES (`.../environments/civicofhome-staging/secrets`).
* **Wrong output committed:** revert via PR (protection makes direct pushes impossible) — never force-push.

## 9. Non-claims

* Green preflight ≠ approval granted. Approval ≠ migrations succeed. Migrations succeed ≠ RLS/AAL2/storage correct. None of it implies production readiness.
* Production deployment is out of scope for this repository **permanently**. Production requires its own separately governed change process.
