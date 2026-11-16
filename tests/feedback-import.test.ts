import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { demoData } from "../src/server/demo-data.ts";
import { validateRealRecord, validateSyntheticRecord } from "../src/server/data-validation.ts";
import { normalizeTimestamp, validateNoiseFeedback } from "../src/server/feedback-validation.ts";
import { generateSyntheticFeedback, insertFeedback } from "../src/server/synthetic-feedback.ts";
import { createSchema, insertWorkspace } from "../src/server/schema.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "quiet-cue-feedback-"));
  const path = join(directory, "catalog.sqlite");
  const file = join(directory, "records.json");
  const database = new DatabaseSync(path);
  createSchema(database);
  insertWorkspace(database, demoData[0]);
  insertWorkspace(database, { ...demoData[0], id: 101, is_demo: 0, published: 0 });
  return {
    database,
    run(script: string, ...args: string[]) {
      return spawnSync(process.execPath, ["--experimental-strip-types", `scripts/${script}.ts`, ...args], { env: { ...process.env, QUIET_CUE_DB_PATH: path }, encoding: "utf8" });
    },
    write(records: unknown) { writeFileSync(file, JSON.stringify(records)); return file; },
    close() { database.close(); rmSync(directory, { recursive: true, force: true }); },
  };
}

const now = new Date("2026-01-15T12:00:00.000Z");
const feedback = {
  id: 1, workspace_id: 1, noise_level: "Quiet", observed_at: "2026-01-14T09:00:00Z",
  submitted_at: "2026-01-14T09:01:00Z", source_type: "synthetic", is_synthetic: 1,
  review_status: "approved", source_reference: null,
};

test("a V0.1 workspace-only database upgrades in place and preserves existing records", () => {
  const context = fixture();
  try {
    context.database.exec("DROP TABLE noise_feedback");
    assert.equal(context.database.prepare("SELECT name FROM sqlite_master WHERE name = 'noise_feedback'").get(), undefined);
    const records = context.database.prepare("SELECT * FROM workspaces ORDER BY id").all();
    const result = context.run("import-records", context.write([{ ...demoData[0], id: 101, is_demo: 0, published: 0 }]));
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(context.database.prepare("SELECT * FROM workspaces ORDER BY id").all(), records);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, 0);
    const imported = context.run("import-feedback", context.write([feedback]));
    assert.equal(imported.status, 0, imported.stderr);
    createSchema(context.database);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, 1);
    assert.deepEqual(context.database.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { context.close(); }
});

test("synthetic workspaces require an explicit marker without invented provenance", () => {
  assert.deepEqual(validateSyntheticRecord(demoData[0], now), demoData[0]);
  assert.throws(() => validateRealRecord(demoData[0], now));
  assert.throws(() => validateSyntheticRecord({ ...demoData[0], is_demo: 0 }, now));
  assert.throws(() => validateSyntheticRecord({ ...demoData[0], noise_level: "unknown" }, now));
  assert.throws(() => validateSyntheticRecord({ ...demoData[0], last_verified_date: "2026-02-30" }, now));
  assert.equal(validateSyntheticRecord(demoData[0], now).last_verified_date, null);
});

test("feedback validates keys, safe IDs, enums, source flags and references", () => {
  assert.equal(validateNoiseFeedback(feedback, now).observed_at, "2026-01-14T09:00:00.000Z");
  for (const invalid of [
    { ...feedback, extra: true }, { ...feedback, id: 0 }, { ...feedback, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...feedback, workspace_id: -1 }, { ...feedback, workspace_id: 1.5 },
    { ...feedback, noise_level: "Unknown" }, { ...feedback, source_type: "unknown" },
    { ...feedback, review_status: "unknown" }, { ...feedback, is_synthetic: true },
    { ...feedback, is_synthetic: 0 }, { ...feedback, source_type: "user_feedback" },
    { ...feedback, source_reference: " " }, { ...feedback, source_reference: "x".repeat(4001) },
    { ...feedback, source_type: "field_observation", is_synthetic: 0 },
  ]) assert.throws(() => validateNoiseFeedback(invalid, now));
  for (const key of Object.keys(feedback)) {
    const incomplete: Record<string, unknown> = { ...feedback };
    delete incomplete[key];
    assert.throws(() => validateNoiseFeedback(incomplete, now), /Missing field/);
  }
  assert.equal(validateNoiseFeedback({ ...feedback, source_type: "user_feedback", is_synthetic: 0, review_status: "pending" }, now).source_reference, null);
  assert.equal(validateNoiseFeedback({ ...feedback, source_type: "field_observation", is_synthetic: 0, source_reference: "Test evidence only" }, now).is_synthetic, 0);
});

test("feedback rejects invalid calendars, noncanonical times, reversed and future timestamps", () => {
  for (const timestamp of ["2026-02-30T09:00:00Z", "2025-02-29T09:00:00Z", "2026-13-01T09:00:00Z", "2026-01-14T24:00:00Z", "2026-01-14T09:00:60Z", "2026-01-14", "2026-01-14T09:00:00+00:00", "2026-01-14T09:00:00.1Z"]) {
    assert.throws(() => normalizeTimestamp(timestamp));
  }
  assert.equal(normalizeTimestamp("2024-02-29T09:00:00Z"), "2024-02-29T09:00:00.000Z");
  assert.throws(() => validateNoiseFeedback({ ...feedback, observed_at: "2026-01-14T10:00:00Z" }, now));
  assert.throws(() => validateNoiseFeedback({ ...feedback, submitted_at: "2026-01-16T09:00:00Z" }, now));
  assert.throws(() => validateNoiseFeedback(feedback, new Date("invalid")));
});

test("default synthetic generator returns 366 deterministic valid records", () => {
  const records = generateSyntheticFeedback(demoData, undefined, now);
  assert.equal(records.length, 366);
  assert.deepEqual(records, generateSyntheticFeedback(demoData, 2101, now));
  assert.notDeepEqual(records, generateSyntheticFeedback(demoData, 42, now));
  for (const record of records) assert.deepEqual(validateNoiseFeedback(record, now), record);
});

test("feedback CLI inserts synthetic and reviewed real fixtures; workspace upserts preserve feedback foreign keys", () => {
  const context = fixture();
  try {
    let result = context.run("import-feedback", context.write([feedback, { ...feedback, id: 2, workspace_id: 101, is_synthetic: 0, source_type: "user_feedback", source_reference: "Automated test fixture, not collected evidence" }]));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(context.database.prepare("SELECT observed_at FROM noise_feedback WHERE id = 1").get()!.observed_at, "2026-01-14T09:00:00.000Z");
    result = context.run("import-records", "--synthetic", context.write([{ ...demoData[0], name: "Updated fictional workspace" }]));
    assert.equal(result.status, 0, result.stderr);
    result = context.run("import-records", context.write([{ ...demoData[0], id: 101, name: "Updated test-only real marker", is_demo: 0, published: 0 }]));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, 2);
    assert.equal(context.database.prepare("SELECT name FROM workspaces WHERE id = 1").get()!.name, "Updated fictional workspace");
    result = context.run("import-feedback", context.write([feedback]));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Record 1 \(id 1\)/);
  } finally { context.close(); }
});

test("feedback CLI rolls back earlier rows on invalid last rows, FK, markers, duplicate IDs and natural keys", () => {
  const context = fixture();
  try {
    const missing: Record<string, unknown> = { ...feedback, id: 2 };
    delete missing.noise_level;
    for (const last of [
      missing, { ...feedback, id: 2, noise_level: "invalid" }, { ...feedback, id: 2, review_status: "invalid" },
      { ...feedback, id: 2, observed_at: "2026-02-30T09:00:00Z" },
      { ...feedback, id: 2, submitted_at: "9999-12-31T23:59:59Z" },
      { ...feedback, id: 2, is_synthetic: 0 }, { ...feedback, id: 2, workspace_id: 999 },
      { ...feedback, id: 2, workspace_id: 101 },
      { ...feedback, id: 2, source_type: "field_observation", is_synthetic: 0, source_reference: "Test only" },
      { ...feedback, id: 2, workspace_id: 101, source_type: "user_feedback", is_synthetic: 0 },
      { ...feedback, observed_at: "2026-01-13T09:00:00Z" },
      { ...feedback, id: 2, observed_at: "2026-01-14T09:00:00.000Z" },
    ]) {
      const result = context.run("import-feedback", context.write([feedback, last]));
      assert.notEqual(result.status, 0, JSON.stringify(last));
      assert.match(result.stderr, new RegExp(`Record 2 \\(id ${last.id}\\)`));
      assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, 0);
    }
    const result = context.run("import-feedback", context.write([feedback]));
    assert.equal(result.status, 0, result.stderr);
    const duplicate = context.run("import-feedback", context.write([{ ...feedback, id: 3, observed_at: "2026-01-12T09:00:00Z" }, { ...feedback, id: 4 }]));
    assert.notEqual(duplicate.status, 0);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, 1);
  } finally { context.close(); }
});

test("workspace CLI never defaults to synthetic, refuses opposite markers and rolls back updates", () => {
  const context = fixture();
  try {
    for (const [records, args] of [
      [[demoData[0]], []],
      [[{ ...demoData[0], id: 101 }], ["--synthetic"]],
      [[{ ...demoData[0], id: 1, is_demo: 0, published: 0 }], []],
      [[{ ...demoData[0], name: "Must roll back" }, { ...demoData[0], id: 2, category: "invalid" }], ["--synthetic"]],
      [[demoData[0], demoData[0]], ["--synthetic"]],
    ] as const) {
      const result = context.run("import-records", ...args, context.write(records));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Record [12] \(id /);
      assert.equal(context.database.prepare("SELECT name FROM workspaces WHERE id = 1").get()!.name, demoData[0].name);
      assert.equal(context.database.prepare("SELECT count(*) AS total FROM workspaces").get()!.total, 2);
    }
  } finally { context.close(); }
});

test("demo seed defaults to seed 2101 and is repeatable with --now while preserving real feedback", () => {
  const context = fixture();
  try {
    insertFeedback(context.database, { ...validateNoiseFeedback(feedback, now), id: 700, workspace_id: 101, source_type: "user_feedback", is_synthetic: 0, source_reference: "Test fixture only" });
    let result = context.run("seed-demo");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /366 synthetic feedback records \(seed 2101,/);
    const generated = context.database.prepare("SELECT * FROM noise_feedback WHERE is_synthetic = 1 ORDER BY id").all();
    const reference = new Date(String(context.database.prepare("SELECT max(submitted_at) AS latest FROM noise_feedback WHERE is_synthetic = 1").get()!.latest));
    assert.deepEqual(JSON.parse(JSON.stringify(generated)), generateSyntheticFeedback(demoData, 2101, reference).map((record, index) => ({ ...record, id: 701 + index })));
    result = context.run("seed-demo", "--now", now.toISOString());
    assert.equal(result.status, 0, result.stderr);
    const snapshot = context.database.prepare("SELECT * FROM noise_feedback ORDER BY id").all();
    result = context.run("seed-demo", "--seed", "2101", "--now", now.toISOString());
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(context.database.prepare("SELECT * FROM noise_feedback ORDER BY id").all(), snapshot);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback WHERE is_synthetic = 0").get()!.total, 1);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM workspaces").get()!.total, 13);
  } finally { context.close(); }
});

test("synthetic management uses existing workspaces, regenerates only feedback and clears only synthetic data", () => {
  const context = fixture();
  try {
    const custom = { ...demoData[1], id: 301, name: "Custom fictional fixture" };
    insertWorkspace(context.database, custom);
    insertFeedback(context.database, { ...validateNoiseFeedback(feedback, now), id: 700, workspace_id: 101, source_type: "user_feedback", is_synthetic: 0, source_reference: "Test fixture only" });
    const workspaces = context.database.prepare("SELECT * FROM workspaces ORDER BY id").all();
    let result = context.run("manage-synthetic", "--seed", "42", "--now", now.toISOString());
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(context.database.prepare("SELECT * FROM workspaces ORDER BY id").all(), workspaces);
    const records = context.database.prepare("SELECT * FROM noise_feedback WHERE is_synthetic = 1 ORDER BY id").all();
    assert.deepEqual(JSON.parse(JSON.stringify(records)), generateSyntheticFeedback([demoData[0], custom], 42, now).map((record, index) => ({ ...record, id: 701 + index })));
    result = context.run("manage-synthetic", "--seed", "42", "--now", now.toISOString());
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(context.database.prepare("SELECT * FROM noise_feedback WHERE is_synthetic = 1 ORDER BY id").all(), records);
    result = context.run("manage-synthetic", "--clear");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM workspaces").get()!.total, 1);
    assert.equal(context.database.prepare("SELECT id FROM workspaces").get()!.id, 101);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, 1);
    assert.equal(context.database.prepare("SELECT id FROM noise_feedback").get()!.id, 700);
    result = context.run("manage-synthetic", "--now", now.toISOString());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Regenerated 0 synthetic feedback records/);
  } finally { context.close(); }
});

test("real dependencies on demo workspaces restrict seed and clear and roll back deleted synthetic feedback", () => {
  const context = fixture();
  try {
    insertFeedback(context.database, validateNoiseFeedback(feedback, now));
    insertFeedback(context.database, { ...validateNoiseFeedback(feedback, now), id: 2, source_type: "user_feedback", is_synthetic: 0, source_reference: "Legacy inconsistent test-only dependency" });
    const before = context.database.prepare("SELECT * FROM noise_feedback ORDER BY id").all();
    for (const [script, args] of [["seed-demo", []], ["manage-synthetic", ["--clear"]]] as const) {
      const result = context.run(script, ...args);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /FOREIGN KEY/);
      assert.deepEqual(context.database.prepare("SELECT * FROM noise_feedback ORDER BY id").all(), before);
      assert.equal(context.database.prepare("SELECT count(*) AS total FROM workspaces").get()!.total, 2);
    }
  } finally { context.close(); }
});

test("synthetic CLIs reject invalid seeds and reference times without changing data", () => {
  const context = fixture();
  try {
    const before = context.database.prepare("SELECT * FROM workspaces ORDER BY id").all();
    for (const script of ["seed-demo", "manage-synthetic"]) {
      for (const args of [["--seed", "1.5"], ["--seed", "9007199254740992"], ["--seed", "NaN"], ["--seed", ""], ["--now", "2026-02-30T00:00:00Z"], ["--now", "invalid"]]) {
        const result = context.run(script, ...args);
        assert.notEqual(result.status, 0, `${script} ${args}`);
        assert.deepEqual(context.database.prepare("SELECT * FROM workspaces ORDER BY id").all(), before);
      }
    }
  } finally { context.close(); }
});

test("English templates import as explicit synthetic examples without fabricated provenance", () => {
  const context = fixture();
  try {
    const workspaces = JSON.parse(readFileSync(new URL("../data/synthetic-workspaces.template.json", import.meta.url), "utf8"));
    const records = JSON.parse(readFileSync(new URL("../data/noise-feedback.template.json", import.meta.url), "utf8"));
    let result = context.run("import-records", "--synthetic", context.write(workspaces));
    assert.equal(result.status, 0, result.stderr);
    result = context.run("import-feedback", context.write(records));
    assert.equal(result.status, 0, result.stderr);
    for (const workspace of workspaces) {
      assert.equal(workspace.is_demo, 1);
      assert.equal(workspace.collection_method, null);
      assert.equal(workspace.last_verified_date, null);
      assert.equal(workspace.source_url, null);
      assert.match(workspace.source_note, /Synthetic/);
    }
    assert.ok(records.every((record: { is_synthetic: number }) => record.is_synthetic === 1));
  } finally { context.close(); }
});

test("demo reset only removes synthetic feedback linked to demo workspaces", () => {
  const context = fixture();
  try {
    const legacy = { ...validateNoiseFeedback(feedback, now), id: 700, workspace_id: 101 };
    insertFeedback(context.database, legacy);
    const result = context.run("seed-demo", "--now", now.toISOString());
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(JSON.stringify(context.database.prepare("SELECT * FROM noise_feedback WHERE id = 700").get())), legacy);
    assert.equal(context.database.prepare("SELECT count(*) AS total FROM noise_feedback").get()!.total, 367);
  } finally { context.close(); }
});