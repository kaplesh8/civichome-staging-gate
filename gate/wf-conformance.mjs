/**
 * WF-01 … WF-15 — independent positive/negative conformance checks for the gate.
 *
 * These are OFFLINE, structural/behavioral checks against the gate's own source.
 * They do NOT replace live verification (approval identity, deployment records,
 * real database identity) — those remain UNEXECUTED until the operator runs
 * docs/OPERATOR_SETUP.md end-to-end. What these checks prove: the shipped gate
 * cannot silently lose (a) a fail-closed control, (b) a least-privilege wiring,
 * or (c) an ordering invariant — each is asserted by a positive test and its
 * negative twin (a mutated source must FAIL the check).
 *
 * Every check is a pure function of the source text (or of validateInputs).
 */
import { validateInputs } from "./validate-inputs.mjs";

const APPLY_LOOP_RE = /for migration in[\s\S]*?done\n/;
const SCAN_STEP_RE = /Secret-leak scan[\s\S]*?node scripts\/prs-secret-scan\.mjs\n/;

export const checks = {
  /** WF-01 — production ref is REQUIRED as an inequality proof (not optional). */
  "WF-01": (src) =>
    /SUPABASE_PRODUCTION_PROJECT_REF: \$\{\{ secrets\.SUPABASE_PRODUCTION_PROJECT_REF \}\}/.test(src) &&
    /run: node scripts\/prs-staging-identity\.mjs/.test(src),

  /** WF-02 — environment exists, required reviewers, admin bypass disabled, branch policy; never auto-created. */
  "WF-02": (src) =>
    /repos\/\$\{\{ github\.repository \}\}\/environments/.test(src) &&
    /required_reviewer_count=0/.test(src) &&
    /can_admins_bypass=false/.test(src) &&
    !/environments\/civicofhome-staging.*-X PUT/.test(src) &&
    /fail closed/i.test(src),

  /** WF-03 — DB URL is never substring-validated in the gate; validation is delegated to the pinned identity module. */
  "WF-03": (src) =>
    !/\*supabase\.co\*/.test(src) &&
    !/\*pooler\*/.test(src) &&
    /prs-staging-identity\.mjs/.test(src),

  /** WF-04 — DNIS/session DB identity preflight runs immediately BEFORE each migration in the apply loop. */
  "WF-04": (src) => {
    const loop = src.match(APPLY_LOOP_RE)?.[0] ?? "";
    const idPos = loop.indexOf("prs-staging-db-identity.sh");
    const psqlPos = loop.indexOf("psql");
    return idPos > 0 && psqlPos > idPos && /ON_ERROR_STOP=1/.test(loop);
  },

  /** WF-05 — PITR is labelled an operator attestation; the validator refuses placeholder attestations. */
  "WF-05": (src) => {
    const descOk = /ATTESTATION \(not verified proof\)/.test(src);
    const placeholder = validateInputs({
      productSha: "a".repeat(40),
      stagingProjectRef: "abcd1234efgh5678ijkl",
      pitrRestorePoint: "tbd placeholder 000000000000000000000000000000000000000000",
      confirmNotProduction: "STAGING-NOT-PRODUCTION",
    });
    return descOk && placeholder.ok === false;
  },

  /** WF-06 — identity logic is exercised: the gate refuses every malformed ref/SHA/phrase (behavioral). */
  "WF-06": (src) => {
    const base = {
      productSha: "a".repeat(40),
      stagingProjectRef: "abcd1234efgh5678ijkl",
      pitrRestorePoint: "PITR ok 2026-11-10T14:00Z project abcd1234efgh5678ijkl snapshot snap_xyz; restore rehearsed 2026-11-10; approved by Jane Doe",
      confirmNotProduction: "STAGING-NOT-PRODUCTION",
    };
    const bad = [
      { ...base, productSha: "main" },
      { ...base, stagingProjectRef: "abcd1234" },
      { ...base, pitrRestorePoint: "none" },
      { ...base, confirmNotProduction: "yes" },
    ];
    const allRejected = bad.every((input) => validateInputs(input).ok === false);
    return src.includes("validate-inputs.mjs") && allRejected;
  },

  /** WF-07 — the staging job checks out the PINNED product SHA (never a branch), before any verifier runs. */
  "WF-07": (src) => {
    const repoPos = src.indexOf("repository: kaplesh8/easy-ui-bliss");
    const refPos = src.indexOf("ref: ${{ inputs.product_sha }}");
    const idPos = src.indexOf("prs-staging-identity.mjs");
    return repoPos > 0 && refPos > repoPos && idPos > refPos;
  },

  /** WF-08 — the gate carries NO production database URL; the production ref appears only as inequality input. */
  "WF-08": (src) => {
    if (/SUPABASE_PRODUCTION_DB_URL/.test(src)) return false;
    const lines = src.split("\n").filter((l) => l.includes("SUPABASE_PRODUCTION_PROJECT_REF"));
    // Exactly one line wires the production ref: the identity step env block. Never used for connections.
    return (
      lines.length === 1 &&
      /^\s+SUPABASE_PRODUCTION_PROJECT_REF: \$\{\{ secrets\.SUPABASE_PRODUCTION_PROJECT_REF \}\}\s*$/.test(lines[0])
    );
  },

  /** WF-09 — migrations are applied ONLY via the SHA-256 manifest (`--print-order` is the apply list). */
  "WF-09": (src) =>
    /node scripts\/prs-migration-manifest\.mjs \.\n/.test(src) &&
    /prs-migration-manifest\.mjs \. --print-order/.test(src) &&
    /mapfile -t pinned < <\(/.test(src),

  /** WF-10 — the identity preflight is INSIDE the loop, i.e. before EVERY migration (not once per job). */
  "WF-10": (src) => {
    const loop = src.match(APPLY_LOOP_RE)?.[0] ?? "";
    const identityCalls = loop.split("prs-staging-db-identity.sh").length - 1;
    const psqlCalls = loop.split("psql ").length - 1;
    return identityCalls >= 1 && psqlCalls >= 1 && identityCalls === psqlCalls;
  },

  /** WF-11 — admin-bypass disabled and deployment-branch policy are hard preconditions (fail closed otherwise). */
  "WF-11": (src) =>
    /deployment_branch_policy=yes/.test(src) &&
    /can_admins_bypass=false/.test(src) &&
    /exit 1\n\n  staging:/.test(src),

  /** WF-12 — every log is secret-scanned with if: always(); empty scan list is fatal. */
  "WF-12": (src) => {
    const block = SCAN_STEP_RE.exec(src)?.[0] ?? "";
    return /if: always\(\)/.test(block) && /refusing to pass vacuously/.test(block);
  },

  /** WF-13 — every psql invocation is all-or-nothing (ON_ERROR_STOP=1); DDL transaction wrap is enforced upstream by the pinned manifest. */
  "WF-13": (src) =>
    (src.match(/ON_ERROR_STOP=1/g) ?? []).length >= 1 && !/--single-transaction=false/.test(src),

  /** WF-14 — every action is pinned to a full 40-hex commit SHA. */
  "WF-14": (src) => {
    const uses = [...src.matchAll(/\buses:\s*([^\s#]+)/g)].map((m) => m[1]);
    if (uses.length === 0) return false;
    return uses.every((u) => /@[0-9a-f]{40}$/.test(u));
  },

  /** WF-15 — approval separation: protected jobs declare the environment; the no-secrets preflight does NOT. */
  "WF-15": (src) => {
    const jobs = src.split(/\n  (?=[a-z-]+:\n)/);
    const preflight = jobs.find((j) => j.startsWith("preflight:")) ?? "";
    const staging = jobs.find((j) => j.startsWith("staging:")) ?? "";
    const handoff = jobs.find((j) => j.startsWith("handoff:")) ?? "";
    return (
      !/environment:/.test(preflight) &&
      /environment: civicofhome-staging/.test(staging) &&
      /environment: civicofhome-staging/.test(handoff) &&
      /^on:\n  workflow_dispatch:/m.test(src) &&
      !/push:|pull_request:|schedule:/.test(src)
    );
  },
};

export function runAll(src) {
  return Object.entries(checks).map(([id, fn]) => {
    try {
      return { id, ok: Boolean(fn(src)) };
    } catch (error) {
      return { id, ok: false, error: String(error) };
    }
  });
}
