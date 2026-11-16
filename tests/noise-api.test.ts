import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSchema, insertWorkspace } from "../src/server/schema.ts";
import { demoData } from "../src/server/demo-data.ts";
import { dayTypes, historicalNotice, syntheticNotice, timePeriods } from "../src/lib/noise.ts";
import { NoiseEstimationService } from "../src/server/noise-estimation.ts";
import { withDatabase } from "../src/server/database.ts";
import { GET } from "../src/app/api/workspaces/[id]/noise-estimate/route.ts";

test("noise service and API isolate sources, validate input, and keep storage read-only", async () => {
  const directory = mkdtempSync(join(tmpdir(), "quiet-cue-noise-api-"));
  const path = join(directory, "catalog.sqlite");
  const previous = process.env.QUIET_CUE_DB_PATH;
  const database = new DatabaseSync(path);
  createSchema(database);
  insertWorkspace(database, { ...demoData[0], id: 1, published: 1, is_demo: 1 });
  insertWorkspace(database, { ...demoData[0], id: 2, published: 1, is_demo: 0 });
  insertWorkspace(database, { ...demoData[0], id: 3, published: 0, is_demo: 1 });
  insertWorkspace(database, { ...demoData[0], id: 4, published: 1, is_demo: 0 });
  const insert = database.prepare(`INSERT INTO noise_feedback
    (workspace_id, noise_level, observed_at, submitted_at, source_type, is_synthetic, review_status, source_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const anchor = new Date();
  anchor.setUTCHours(9, 0, 0, 0);
  anchor.setUTCDate(anchor.getUTCDate() - 7);
  while ([0, 6].includes(anchor.getUTCDay())) anchor.setUTCDate(anchor.getUTCDate() - 1);
  for (const workspaceId of [1, 2, 3]) {
    for (let index = 0; index < 3; index++) {
      const observed = new Date(anchor.getTime() + index * 60_000).toISOString();
      insert.run(workspaceId, "Quiet", observed, observed, "synthetic", 1, "approved", null);
      insert.run(workspaceId, "Lively", observed, observed, "field_observation", 0, "approved", "field-ref");
    }
  }
  for (const workspaceId of [1, 2]) {
    const synthetic = workspaceId === 1;
    const source = synthetic ? "synthetic" : "user_feedback";
    const reference = synthetic ? null : "feedback-ref";
    for (const [index, review] of ["pending", "rejected"].entries()) {
      const observed = new Date(anchor.getTime() + (index + 10) * 60_000).toISOString();
      insert.run(workspaceId, "Moderate", observed, observed, source, Number(synthetic), review, reference);
    }
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const stale = new Date(anchor.getTime() - 180 * 86_400_000).toISOString();
    for (const [observed, submitted] of [
      [future, future], [stale, stale], ["invalid-date", anchor.toISOString()],
      [new Date(anchor.getTime() + 20 * 60_000).toISOString(), future],
      [new Date(anchor.getTime() + 21 * 60_000).toISOString(), "invalid-date"],
    ]) insert.run(workspaceId, "Moderate", observed, submitted, source, Number(synthetic), "approved", reference);
  }
  database.exec("PRAGMA ignore_check_constraints = ON");
  for (const reference of [null, "  "]) {
    const observed = new Date(anchor.getTime() + (reference === null ? 30 : 31) * 60_000).toISOString();
    insert.run(2, "Quiet", observed, observed, "field_observation", 0, "approved", reference);
  }
  database.exec("PRAGMA ignore_check_constraints = OFF");
  database.close();
  const before = readFileSync(path);
  process.env.QUIET_CUE_DB_PATH = path;
  const request = (id = "1", query = "") => GET(new Request(`http://localhost/api/workspaces/${encodeURIComponent(id)}/noise-estimate${query}`), { params: Promise.resolve({ id }) });
  try {
    let clockCalls = 0;
    const fixedNow = new Date();
    const service = new NoiseEstimationService({ now: () => { clockCalls++; return fixedNow; } });
    const result = service.estimate(1);
    assert.ok(result);
    assert.equal(clockCalls, 1);
    assert.equal(result.estimate.sampleCount, 3);
    assert.equal(result.estimate.estimatedNoiseLevel, "Quiet");
    assert.equal(result.estimate.dataSource, "synthetic");
    assert.deepEqual(result.overview.map(item => item.timePeriod), ["Morning", "Afternoon", "Evening"]);
    assert.ok(result.overview.every(item => item.calculatedAt === fixedNow.toISOString()));
    assert.deepEqual(result.overview.map(item => item.sampleCount), [3, 0, 0]);
    assert.deepEqual(service.overview(1), result.overview);
    assert.deepEqual(result.notices, [historicalNotice, syntheticNotice]);
    const real = service.estimate(2);
    assert.ok(real);
    assert.equal(real.estimate.estimatedNoiseLevel, "Lively");
    assert.equal(real.estimate.sampleCount, 3);
    assert.equal(real.estimate.isSynthetic, false);
    assert.equal(real.estimate.dataSource, "real");
    assert.deepEqual(real.notices, [historicalNotice]);
    assert.equal(service.estimate(3), null);
    assert.equal(service.overview(999), null);
    assert.deepEqual(new NoiseEstimationService({ now: fixedNow, historyDays: 1 }).estimate(1)?.overview.map(item => item.sampleCount), [0, 0, 0]);

    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["estimate", "notices", "overview"]);
    assert.equal(body.estimate.dayType, "Weekday");
    assert.equal(body.estimate.timePeriod, "Morning");
    assert.equal(body.estimate.sampleCount, 3);
    const empty = await (await request("4")).json();
    assert.equal(empty.estimate.dataSource, "none");
    assert.equal(empty.estimate.estimatedNoiseLevel, null);
    assert.deepEqual(empty.notices, [historicalNotice]);
    const afternoon = await (await request("1", "?dayType=Weekday&timePeriod=Afternoon")).json();
    assert.equal(afternoon.estimate.sampleCount, 0);
    assert.deepEqual(afternoon.notices, [historicalNotice, syntheticNotice]);
    const realResponse = await (await request("2")).json();
    assert.equal(realResponse.estimate.dataSource, "real");
    assert.equal(realResponse.estimate.sampleCount, 3);
    assert.deepEqual(realResponse.notices, [historicalNotice]);
    for (const dayType of dayTypes) {
      for (const timePeriod of timePeriods) {
        const valid = await request("1", `?dayType=${dayType}&timePeriod=${timePeriod}`);
        assert.equal(valid.status, 200);
        const selected = await valid.json();
        assert.equal(selected.estimate.dayType, dayType);
        assert.equal(selected.estimate.timePeriod, timePeriod);
        assert.equal(selected.estimate.sampleCount, dayType === "Weekday" && timePeriod === "Morning" ? 3 : 0);
        assert.deepEqual(selected.estimate, selected.overview.find((item: { timePeriod: string }) => item.timePeriod === timePeriod));
        assert.ok(selected.overview.every((item: { dayType: string; calculatedAt: string }) =>
          item.dayType === dayType && item.calculatedAt === selected.estimate.calculatedAt));
      }
    }
    for (const query of ["?dayType=Weekend", "?timePeriod=Evening"]) {
      assert.equal((await request("1", query)).status, 200);
    }
    for (const query of [
      "?unknown=value", "?dayType=", "?timePeriod=", "?dayType=weekday", "?timePeriod=Night",
      "?dayType=Weekday&dayType=Weekday", "?timePeriod=Morning&timePeriod=Evening",
      "?dayType=Weekday&dayType=", "?dayType=Weekday&%64ayType=Weekend", "?dayType=%20Weekday", "?timePeriod=Morning%00",
      "?dayType=Weekday%27%20OR%201%3D1", "?timePeriod=%3Cscript%3Ealert(1)%3C/script%3E",
    ]) {
      const invalid = await request("1", query);
      assert.equal(invalid.status, 400, query);
      assert.equal(invalid.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await invalid.json(), { error: "Invalid request parameters." });
    }
    for (const id of ["0", "-1", "01", "1.5", "1e0", "1 ", "9007199254740992", "1 OR 1=1", "<script>alert(1)</script>", ""]) {
      const invalid = await request(id);
      assert.equal(invalid.status, 400, id);
      assert.deepEqual(await invalid.json(), { error: "Invalid request parameters." });
    }
    for (const id of ["3", "999"]) {
      const missing = await request(id);
      assert.equal(missing.status, 404);
      assert.equal(missing.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await missing.json(), { error: "Workspace not found." });
    }
    assert.throws(() => withDatabase(connection => connection.exec("DELETE FROM noise_feedback")), /readonly/i);
    assert.deepEqual(readFileSync(path), before);
    const missingPath = join(directory, "private-missing.sqlite");
    process.env.QUIET_CUE_DB_PATH = missingPath;
    const failed = await request();
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await failed.json(), { error: "Results temporarily unavailable." });
    assert.equal(existsSync(missingPath), false);
    assert.equal((await request("1 OR 1=1")).status, 400);
    assert.equal((await request("1", "?unknown=1")).status, 400);
    const brokenPath = join(directory, "private-schema.sqlite");
    const broken = new DatabaseSync(brokenPath);
    broken.exec("CREATE TABLE private_schema (secret TEXT)");
    broken.close();
    process.env.QUIET_CUE_DB_PATH = brokenPath;
    const brokenResponse = await request();
    assert.equal(brokenResponse.status, 503);
    assert.deepEqual(await brokenResponse.json(), { error: "Results temporarily unavailable." });
  } finally {
    if (previous === undefined) delete process.env.QUIET_CUE_DB_PATH; else process.env.QUIET_CUE_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});