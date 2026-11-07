import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { demoData } from "../src/server/demo-data.ts";

test("demo seed is repeatable; import is validated, atomic and preserves existing data", () => {
  const directory = mkdtempSync(join(tmpdir(), "quiet-cue-import-"));
  const path = join(directory, "catalog.sqlite");
  const file = join(directory, "records.json");
  const run = (script: string, ...args: string[]) => spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], { env: { ...process.env, QUIET_CUE_DB_PATH: path }, encoding: "utf8" });
  const count = () => {
    const database = new DatabaseSync(path, { readOnly: true });
    try { return database.prepare("SELECT count(*) AS total FROM workspaces").get()!.total; } finally { database.close(); }
  };
  const real = { ...demoData[0], id: 101, name: "Test-only provenance fixture", is_demo: 0, collection_method: "Field Observation", observation_ref: "Automated test evidence only", last_verified_date: "2026-01-01" };
  try {
    assert.equal(run("scripts/seed-demo.ts").status, 0);
    assert.equal(run("scripts/seed-demo.ts").status, 0);
    assert.equal(count(), 12);
    writeFileSync(file, JSON.stringify([real]));
    assert.equal(run("scripts/import-records.ts", file).status, 0);
    assert.equal(count(), 13);
    assert.equal(run("scripts/seed-demo.ts").status, 0);
    assert.equal(count(), 13);
    writeFileSync(file, JSON.stringify([{ ...real, id: 102 }, { ...real, id: 1 }]));
    assert.notEqual(run("scripts/import-records.ts", file).status, 0);
    assert.equal(count(), 13);
    writeFileSync(file, JSON.stringify([{ ...real, source_note: null }]));
    assert.notEqual(run("scripts/import-records.ts", file).status, 0);
    assert.equal(count(), 13);
    writeFileSync(file, JSON.stringify([real, real]));
    assert.notEqual(run("scripts/import-records.ts", file).status, 0);
    const database = new DatabaseSync(path, { readOnly: true });
    try { assert.throws(() => database.prepare("DELETE FROM workspaces").run()); } finally { database.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});