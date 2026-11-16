import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import type { Workspace } from "../src/lib/model.ts";
import { databasePath } from "../src/server/database.ts";
import { columns, createSchema } from "../src/server/schema.ts";
import { normalizeTimestamp, validateNoiseFeedback } from "../src/server/feedback-validation.ts";
import { generateSyntheticFeedback, replaceSyntheticFeedback } from "../src/server/synthetic-feedback.ts";

const { values } = parseArgs({ options: { clear: { type: "boolean", default: false }, seed: { type: "string", default: "2101" }, now: { type: "string" } } });
const seed = Number(values.seed);
if (!/^-?\d+$/.test(values.seed!) || !Number.isSafeInteger(seed)) throw new Error("--seed must be a safe integer.");
const now = values.now === undefined ? new Date() : new Date(normalizeTimestamp(values.now, "--now"));
const path = databasePath();
mkdirSync(dirname(path), { recursive: true });
const database = new DatabaseSync(path);
try {
  createSchema(database);
  database.exec("BEGIN IMMEDIATE");
  if (values.clear) {
    database.exec("DELETE FROM noise_feedback WHERE is_synthetic = 1");
    database.exec("DELETE FROM workspaces WHERE is_demo = 1");
    console.log("Cleared synthetic feedback and fictional workspaces. No real records deleted.");
  } else {
    const workspaces = database.prepare(`SELECT ${columns.join(",")} FROM workspaces WHERE is_demo = 1 ORDER BY id`).all() as unknown as Workspace[];
    const records = generateSyntheticFeedback(workspaces, seed, now).map(record => validateNoiseFeedback(record, now));
    const maximum = Number(database.prepare("SELECT coalesce(max(id), 0) AS id FROM noise_feedback WHERE is_synthetic = 0").get()!.id);
    if (!Number.isSafeInteger(maximum + records.length)) throw new Error("Not enough safe feedback IDs after real records.");
    replaceSyntheticFeedback(database, records);
    console.log(`Regenerated ${records.length} synthetic feedback records for ${workspaces.length} existing fictional workspaces (seed ${seed}, now ${now.toISOString()}). No real collection or verification is represented.`);
  }
  database.exec("COMMIT");
} catch (error) {
  if (database.isTransaction) database.exec("ROLLBACK");
  throw error;
} finally { database.close(); }