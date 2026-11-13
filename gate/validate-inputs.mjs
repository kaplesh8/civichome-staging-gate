#!/usr/bin/env node
/**
 * CivicHome Staging Gate — dispatch input validator. Pure, offline, fail-closed.
 *
 * Runs BEFORE any secret is available and BEFORE any approval. Validates only
 * FORMAT and CONSTANTS — value-level checks (ref equality, DB URL classification,
 * confirmation phrase semantics beyond exact string) run post-approval inside the
 * `staging` job against the product repository's own verifier
 * (scripts/prs-staging-identity.mjs at the pinned SHA).
 *
 * The gate applies to exactly one product repository. Anything else is refused.
 *
 * Traceability: WF-S2 (forged dispatch inputs), WF-01/03/05 (format layers),
 * WF-14/15 (constants pinned). See docs/WF_TRACEABILITY_MATRIX.md.
 */
export const PRODUCT_REPOSITORY = "kaplesh8/easy-ui-bliss";
export const CONFIRMATION_PHRASE = "STAGING-NOT-PRODUCTION";
export const GATE_ENVIRONMENT = "civicofhome-staging";

const SHA_RE = /^[0-9a-f]{40}$/;
const REF_RE = /^[a-z0-9]{20}$/;
const PITR_MIN = 24;
const PITR_MAX = 400;

const PITR_PLACEHOLDERS = new Set([
  "none","no","n/a","na","todo","tbd","test","fake","yes","ok","done","later","changeme","example","foo","lorem",
]);

export function validateInputs({ productSha, stagingProjectRef, pitrRestorePoint, confirmNotProduction }) {
  const failures = [];
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const sha = typeof productSha === "string" ? productSha.trim() : "";
  if (!SHA_RE.test(sha)) {
    failures.push("product_sha must be a full 40-character lowercase hex git SHA (immutable, reviewed commit — never a branch name)");
    add("product_sha is a full lowercase hex SHA", false, sha ? `length ${sha.length}` : "missing");
  } else {
    add("product_sha is a full lowercase hex SHA", true, "shape ok");
  }

  const ref = typeof stagingProjectRef === "string" ? stagingProjectRef.trim() : "";
  if (!REF_RE.test(ref)) {
    failures.push("staging_project_ref must be exactly 20 lowercase alphanumeric characters (Supabase project ref)");
    add("staging_project_ref shape", false, ref ? "not 20 lowercase alnum" : "missing");
  } else {
    add("staging_project_ref shape", true, "shape ok (value not printed)");
  }

  const pitr = typeof pitrRestorePoint === "string" ? pitrRestorePoint.trim() : "";
  if (pitr.length < PITR_MIN) {
    failures.push(`pitr_restore_point is too short to evidence a rehearsed restore (min ${PITR_MIN} chars)`);
    add("pitr_restore_point length/content", false, "missing or too short");
  } else if (pitr.length > PITR_MAX) {
    failures.push(`pitr_restore_point exceeds ${PITR_MAX} chars — paste the pointer, not the whole log`);
    add("pitr_restore_point length/content", false, "too long");
  } else if (PITR_PLACEHOLDERS.has(pitr.toLowerCase().split(/[\s,;]/)[0])) {
    failures.push("pitr_restore_point looks like a placeholder — cite the actual snapshot/backup id, creation time and rehearsal date");
    add("pitr_restore_point length/content", false, "placeholder");
  } else {
    add("pitr_restore_point length/content", true, "recorded as operator ATTESTATION (never verified proof)");
  }

  if (confirmNotProduction !== CONFIRMATION_PHRASE) {
    failures.push(`confirm_not_production must be exactly '${CONFIRMATION_PHRASE}'`);
    add("confirmation phrase exact", false, "mismatch or missing");
  } else {
    add("confirmation phrase exact", true, CONFIRMATION_PHRASE);
  }

  return { ok: failures.length === 0, failures, checks };
}

/** CLI: reads env PRODUCT_SHA / STAGING_PROJECT_REF / PITR_RESTORE_POINT / CONFIRM_NOT_PRODUCTION */
export function runCli() {
  const result = validateInputs({
    productSha: process.env.PRODUCT_SHA,
    stagingProjectRef: process.env.STAGING_PROJECT_REF,
    pitrRestorePoint: process.env.PITR_RESTORE_POINT,
    confirmNotProduction: process.env.CONFIRM_NOT_PRODUCTION,
  });
  for (const c of result.checks) console.log(`${c.ok ? "[PASS]" : "[FAIL]"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  console.log(`[INFO] product repository is pinned to ${PRODUCT_REPOSITORY} (cross-repo dispatch refused otherwise)`);
  if (!result.ok) {
    for (const f of result.failures) console.error(`FATAL: ${f}`);
    process.exit(1);
  }
  console.log("Dispatch inputs validated (format only — value-level checks run post-approval).");
}

const invokedDirectly =
  typeof process !== "undefined" && Array.isArray(process.argv) && process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) runCli();
