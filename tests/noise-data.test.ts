import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createSchema, insertWorkspace } from "../src/server/schema.ts";
import { demoData } from "../src/server/demo-data.ts";
import { generateSyntheticFeedback, insertFeedback, replaceSyntheticFeedback } from "../src/server/synthetic-feedback.ts";

test("synthetic feedback is seeded, varied, repeatable and foreign-key constrained", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const records = generateSyntheticFeedback(demoData, 42, now);
  assert.ok(records.length >= 200 && records.length <= 500);
  assert.deepEqual(records, generateSyntheticFeedback(demoData, 42, now));
  assert.notDeepEqual(records, generateSyntheticFeedback(demoData, 43, now));
  assert.ok(records.every(record => record.is_synthetic === 1 && record.source_type === "synthetic"));
  const database = new DatabaseSync(":memory:");
  try {
    createSchema(database);
    assert.throws(() => insertFeedback(database, records[0]), /FOREIGN KEY/);
    for (const workspace of demoData) insertWorkspace(database, workspace);
    replaceSyntheticFeedback(database, records);
    replaceSyntheticFeedback(database, records);
    assert.equal(database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, records.length);
    assert.throws(() => database.exec("DELETE FROM workspaces WHERE id = 1"), /FOREIGN KEY/);
  } finally { database.close(); }
});