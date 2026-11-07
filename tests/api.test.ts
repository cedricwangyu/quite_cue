import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSchema, insertWorkspace } from "../src/server/schema.ts";
import { demoData } from "../src/server/demo-data.ts";
import { GET as catalogGet } from "../src/app/api/workspaces/route.ts";
import { GET as detailGet } from "../src/app/api/workspaces/[id]/route.ts";

test("route handlers validate input, hide unpublished data, and sanitize database failures", async () => {
  const directory = mkdtempSync(join(tmpdir(), "quiet-cue-api-"));
  const path = join(directory, "catalog.sqlite");
  const previous = process.env.QUIET_CUE_DB_PATH;
  const database = new DatabaseSync(path);
  createSchema(database);
  for (const record of demoData) insertWorkspace(database, record);
  database.close();
  process.env.QUIET_CUE_DB_PATH = path;
  try {
    const response = await catalogGet(new Request("http://localhost/api/workspaces?task=Quiet+Study"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).workspaces.length, 11);
    for (const query of ["task=AI", "noise=Loud", "category=Park", "cost=Cheap", "wifi=Unknown", `search=${"a".repeat(101)}`]) assert.equal((await catalogGet(new Request(`http://localhost/api/workspaces?${query}`))).status, 400);
    for (const id of ["12", "999"]) assert.equal((await detailGet(new Request("http://localhost"), { params: Promise.resolve({ id }) })).status, 404);
    assert.equal((await detailGet(new Request("http://localhost"), { params: Promise.resolve({ id: "1 OR 1=1" }) })).status, 400);
    assert.equal((await detailGet(new Request("http://localhost"), { params: Promise.resolve({ id: "1" }) })).status, 200);
    process.env.QUIET_CUE_DB_PATH = join(directory, "missing.sqlite");
    for (const failed of [await catalogGet(new Request("http://localhost/api/workspaces")), await detailGet(new Request("http://localhost"), { params: Promise.resolve({ id: "1" }) })]) {
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { error: "Results temporarily unavailable." });
    }
  } finally {
    if (previous === undefined) delete process.env.QUIET_CUE_DB_PATH; else process.env.QUIET_CUE_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});