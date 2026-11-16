import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { databasePath } from "../src/server/database.ts";
import { columns, createSchema, insertWorkspace } from "../src/server/schema.ts";
import { demoData } from "../src/server/demo-data.ts";
import type { Workspace } from "../src/lib/model.ts";
import { normalizeTimestamp, validateNoiseFeedback } from "../src/server/feedback-validation.ts";
import { generateSyntheticFeedback, insertFeedback } from "../src/server/synthetic-feedback.ts";

const { values } = parseArgs({ options: { seed: { type: "string", default: "2101" }, now: { type: "string" } } });
const seed = Number(values.seed);
if (!/^-?\d+$/.test(values.seed!) || !Number.isSafeInteger(seed)) throw new Error("--seed must be a safe integer.");
const now = values.now === undefined ? new Date() : new Date(normalizeTimestamp(values.now, "--now"));

const path = databasePath();
mkdirSync(dirname(path), { recursive: true });
const database = new DatabaseSync(path);
try {
  createSchema(database);
  database.exec("BEGIN IMMEDIATE");
  database.exec("DELETE FROM noise_feedback WHERE is_synthetic = 1 AND workspace_id IN (SELECT id FROM workspaces WHERE is_demo = 1)");
  database.exec("DELETE FROM workspaces WHERE is_demo = 1");
  for (const record of demoData) insertWorkspace(database, record);
  const workspaces = database.prepare(`SELECT ${columns.join(",")} FROM workspaces WHERE is_demo = 1 ORDER BY id`).all() as unknown as Workspace[];
  const feedback = generateSyntheticFeedback(workspaces, seed, now);
  const maximum = Number(database.prepare("SELECT coalesce(max(id), 0) AS id FROM noise_feedback").get()!.id);
  if (!Number.isSafeInteger(maximum + feedback.length)) throw new Error("Not enough safe feedback IDs after existing records.");
  for (const [index, record] of feedback.entries()) insertFeedback(database, validateNoiseFeedback({ ...record, id: maximum + index + 1 }, now));
  database.exec("COMMIT");
  console.log(`Demo initialized: 11 public fictional records + 1 unpublished fixture; ${feedback.length} synthetic feedback records (seed ${seed}, now ${now.toISOString()}). No real records replaced or collected.`);
} catch (error) {
  if (database.isTransaction) database.exec("ROLLBACK");
  throw error;
} finally { database.close(); }