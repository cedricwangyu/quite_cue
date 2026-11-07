import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createSchema, insertWorkspace } from "../src/server/schema.ts";
import { demoData } from "../src/server/demo-data.ts";
import { getWorkspace, searchWorkspaces } from "../src/server/catalog.ts";
import { parseFilters } from "../src/lib/input.ts";
import { validateRealRecord } from "../src/server/data-validation.ts";

function fixture() {
  const database = new DatabaseSync(":memory:");
  createSchema(database);
  for (const record of demoData) insertWorkspace(database, record);
  return database;
}
test("search name, area, case-insensitive and trimmed; empty returns all public", () => {
  const database = fixture();
  try {
    for (const search of ["willow", "WILLOW", "  Willow  "]) assert.equal(searchWorkspaces(parseFilters(new URLSearchParams({ search })), database)[0].id, 1);
    assert.equal(searchWorkspaces({ search: "East Quarter" }, database).length, 3);
    assert.equal(searchWorkspaces({ search: "CAFÉ" }, database).length, 2);
    assert.equal(searchWorkspaces({ search: "" }, database).length, 11);
    assert.equal(searchWorkspaces({ search: "missing venue" }, database).length, 0);
  } finally { database.close(); }
});
test("AND filters combine with search; Unknown is not true", () => {
  const database = fixture();
  try {
    assert.deepEqual(searchWorkspaces({ search: "Library", category: "Library", noise: "Quiet", wifi: true, cost: "Free" }, database).map(record => record.id), [1]);
    assert.equal(searchWorkspaces({ search: "Copper", wifi: true }, database).length, 0);
    assert.equal(searchWorkspaces({ search: "", wifi: true, outlets: true, group: true }, database).length, 3);
  } finally { database.close(); }
});
test("only published details are readable", () => {
  const database = fixture();
  try { assert.equal(getWorkspace(12, database), null); assert.equal(getWorkspace(999, database), null); assert.equal(getWorkspace(1, database)?.name, "Willow Reading Library"); }
  finally { database.close(); }
});
test("SQL injection, XSS and LIKE wildcards are literal search text", () => {
  const database = fixture();
  try {
    for (const search of ["' OR 1=1 --", "'; DROP TABLE workspaces; --", "<script>alert(1)</script>", "%", "_", "\\"]) assert.equal(searchWorkspaces({ search }, database).length, 0);
    assert.equal(searchWorkspaces({ search: "" }, database).length, 11);
  } finally { database.close(); }
});
test("ranking runs on filtered records only", () => {
  const database = fixture();
  try {
    const results = searchWorkspaces({ search: "", category: "Café", task: "Remote Work" }, database);
    assert.deepEqual(results.map(record => [record.id, record.score]), [[6, 3], [3, 2]]);
  } finally { database.close(); }
});
test("published real data requires method-specific provenance and valid dates", () => {
  const record = { ...demoData[0], id: 101, is_demo: 0, collection_method: "Online Source", source_url: "https://example.org/venue", source_note: "Test evidence fixture, not an imported venue", last_verified_date: "2026-01-01" };
  assert.equal(validateRealRecord(record).id, 101);
  for (const update of [{ source_url: null }, { source_note: null }, { last_verified_date: null }, { last_verified_date: "2026-02-30" }, { last_verified_date: "2099-01-01" }, { source_url: "javascript:alert(1)" }, { collection_method: "Field Observation", observation_ref: null }, { collection_method: "Both", observation_ref: null }, { wifi: true }, { is_demo: 1 }, { noise_level: "Silent" }]) assert.throws(() => validateRealRecord({ ...record, ...update }));
  assert.doesNotThrow(() => validateRealRecord({ ...record, collection_method: "Both", observation_ref: "test-only field note" }));
});
test("draft can preserve Unknown; missing fields and duplicate schema IDs are rejected", () => {
  assert.doesNotThrow(() => validateRealRecord({ ...demoData[9], is_demo: 0, published: 0 }));
  assert.throws(() => validateRealRecord({ id: 1 }));
  const database = fixture();
  try { assert.throws(() => insertWorkspace(database, demoData[0])); } finally { database.close(); }
});