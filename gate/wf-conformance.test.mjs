import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checks, runAll } from "./wf-conformance.mjs";

const WORKFLOW = readFileSync(
  new URL("../.github/workflows/staging-integration.yml", import.meta.url),
  "utf8",
);

test("WF-01..WF-15 all PASS on the shipped gate source", () => {
  const results = runAll(WORKFLOW);
  for (const r of results) assert.equal(r.ok, true, `${r.id} failed: ${JSON.stringify(r)}`);
  assert.equal(results.length, 15);
});

/** Negative twins: each mutation MUST break its own control (proves the check has teeth). */
const NEGATIVES = [
  ["WF-01", (s) => s.replace("          SUPABASE_PRODUCTION_PROJECT_REF: ${{ secrets.SUPABASE_PRODUCTION_PROJECT_REF }}\n", "")],
  ["WF-02", (s) => s.replace("can_admins_bypass=false", "can_admins_bypass=true")],
  ["WF-03", (s) => s.replace("prs-staging-identity.mjs", "echo substring-check")],
  ["WF-04", (s) => s.replace("            bash scripts/prs-staging-db-identity.sh\n", "")],
  ["WF-05", (s) => s.replace("ATTESTATION (not verified proof)", "proof of backup")],
  ["WF-06", (s) => s.replace("validate-inputs.mjs", "e2e-only.mjs")],
  ["WF-07", (s) => s.replace("          ref: ${{ inputs.product_sha }}\n", "          ref: main\n")],
  ["WF-08", (s) => s + "\n          SUPABASE_PRODUCTION_DB_URL: ${{ secrets.SUPABASE_STAGING_DB_URL }}\n"],
  ["WF-09", (s) => s.replace("mapfile -t pinned < <(node scripts/prs-migration-manifest.mjs . --print-order | sed -n 's/^MIGRATION //p')", "mapfile -t pinned < <(ls supabase/migrations/*.sql)")],
  ["WF-10", (s) => s.replace("            bash scripts/prs-staging-db-identity.sh\n", "")],
  ["WF-11", (s) => s.replace("deployment_branch_policy=yes", "deployment_branch_policy=unknown")],
  ["WF-12", (s) => s.replace("if: always()\n        working-directory: product\n        shell: bash\n        env:\n          SUPABASE_STAGING_DB_URL", "if: success()\n        working-directory: product\n        shell: bash\n        env:\n          SUPABASE_STAGING_DB_URL")],
  ["WF-13", (s) => s.replace("-v ON_ERROR_STOP=1", "")],
  ["WF-14", (s) => s.replace("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", "actions/checkout@v7.0.1")],
  ["WF-15", (s) => s.replace("  preflight:\n    name: Gate — input format validation (no secrets, no approval yet)\n    runs-on: ubuntu-latest\n    steps:", "  preflight:\n    name: Gate — input format validation (no secrets, no approval yet)\n    runs-on: ubuntu-latest\n    environment: civicofhome-staging\n    steps:")],
];

for (const [id, mutate] of NEGATIVES) {
  test(`${id} — mutated source FAILS its control (negative twin)`, () => {
    const mutated = mutate(WORKFLOW);
    assert.notEqual(mutated, WORKFLOW, `mutation for ${id} did not apply`);
    assert.equal(checks[id](mutated), false, `${id} failed to detect its own mutation`);
  });
}
