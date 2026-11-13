# Security policy

## Scope

This repository contains the CivicHome staging deployment gate and its documentation. It holds **no secrets** in the tree. All runtime credentials live in the `civicofhome-staging` GitHub environment, are set by the owner, and are exposed only to a job approved by a required reviewer.

## Secrets (five, environment-scoped)

| Name | Purpose | Printed by any step? |
|------|---------|----------------------|
| `APP_ID` | GitHub App ID for token minting | No |
| `APP_PRIVATE_KEY` | GitHub App private key (PEM) | No |
| `SUPABASE_STAGING_PROJECT_REF` | Staging project ref (target) | No — used for comparison only |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Production project ref (inequality proof only) | No — never contacted |
| `SUPABASE_STAGING_DB_URL` | Staging Postgres connection URL | No — password extracted in-memory for the log scan only |

Rules:

1. Never commit a secret value, backup of a secret, or `.env` file. `.gitignore` blocks the common cases; review before pushing.
2. Never add a sixth secret. If one seems required, the gate design is being misused — stop and escalate.
3. Never move a secret to repository/org scope or into the product repository.
4. The App private key may be rotated at any time; the gate has no other credential.
5. Incident response: suspected exposure → follow `docs/OPERATOR_SETUP.md` §8 (revoke → rotate → verify → audit runs). Never open a public issue containing any credential.

## Reporting a vulnerability

Open a **private** security advisory on this repository, or contact the repository owner directly. Include reproduction steps, commit SHA, and impact. Do **not** file public issues for exploitable findings involving workflow or environment configuration.

## Supported versions

`main` plus the current release branch. The gate is a deployment control, not a distributable package.

## Licence / warranty

Provided as-is. No express or implied warranty. Use only with the product repository `kaplesh8/easy-ui-bliss` at a reviewed, CI-green, manifest-verified SHA.
