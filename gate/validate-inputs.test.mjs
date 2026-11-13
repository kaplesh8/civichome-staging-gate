import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInputs, PRODUCT_REPOSITORY, CONFIRMATION_PHRASE } from "./validate-inputs.mjs";

const GOOD = {
  productSha: "648d2dec985d9661649565c976b7503487f9eae2",
  stagingProjectRef: "abcd1234efgh5678ijkl",
  pitrRestorePoint: "PITR ok 2026-11-10T14:00Z project abcd1234efgh5678ijkl snapshot snap_xyz; restore rehearsed 2026-11-10 in throwaway project mnop; approved by Jane Doe",
  confirmNotProduction: CONFIRMATION_PHRASE,
};

test("accepts a well-formed dispatch", () => {
  const r = validateInputs(GOOD);
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test("rejects a branch name instead of a SHA", () => {
  for (const sha of ["main", "HEAD", "arena/08c686c4", "648d2de", "648d2dec985d9661649565C976b7503487f9eae2", "g".repeat(40)]) {
    const r = validateInputs({ ...GOOD, productSha: sha });
    assert.equal(r.ok, false, `expected rejection of sha=${sha}`);
  }
});

test("rejects malformed staging refs", () => {
  for (const ref of ["", "abc", "ABCD1234EFGH5678IJKL", "abcd1234-fgh5678ijkl", "a".repeat(19), "a".repeat(21)]) {
    const r = validateInputs({ ...GOOD, stagingProjectRef: ref });
    assert.equal(r.ok, false, `expected rejection of ref=${JSON.stringify(ref)}`);
  }
});

test("rejects placeholder or too-short PITR attestations", () => {
  for (const pitr of ["", "none", "tbd", "N/A", "PITR done", "ok", "short"]) {
    const r = validateInputs({ ...GOOD, pitrRestorePoint: pitr });
    assert.equal(r.ok, false, `expected rejection of pitr=${JSON.stringify(pitr)}`);
  }
});

test("rejects wrong confirmation phrase (incl. trailing newline smuggling)", () => {
  for (const confirmNotProduction of ["staging-not-production", "STAGING_NOT_PRODUCTION", "STAGING-NOT-PRODUCTION ", CONFIRMATION_PHRASE + "\n", ""]) {
    const r = validateInputs({ ...GOOD, confirmNotProduction });
    assert.equal(r.ok, false, `expected rejection of confirm=${JSON.stringify(confirmNotProduction)}`);
  }
});

test("product repository constant is exactly kaplesh8/easy-ui-bliss", () => {
  assert.equal(PRODUCT_REPOSITORY, "kaplesh8/easy-ui-bliss");
});

test("over-long PITR attestations are refused (paste pointer, not logs)", () => {
  const r = validateInputs({ ...GOOD, pitrRestorePoint: "x".repeat(401) });
  assert.equal(r.ok, false);
});
