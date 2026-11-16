import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { databasePath } from "../src/server/database.ts";
import { createSchema } from "../src/server/schema.ts";
import { validateNoiseFeedback } from "../src/server/feedback-validation.ts";
import { insertFeedback } from "../src/server/synthetic-feedback.ts";

const { positionals } = parseArgs({ allowPositionals: true });
const filename = positionals[0];
if (!filename || positionals.length !== 1) throw new Error("Usage: node --experimental-strip-types scripts/import-feedback.ts path/to/feedback.json");
const input: unknown = JSON.parse(readFileSync(filename, "utf8"));
if (!Array.isArray(input)) throw new Error("Import must be a JSON array.");
const path = databasePath();
mkdirSync(dirname(path), { recursive: true });
const database = new DatabaseSync(path);
try {
  createSchema(database);
  database.exec("BEGIN IMMEDIATE");
  const now = new Date();
  for (const [index, raw] of input.entries()) {
    try {
      const record = validateNoiseFeedback(raw, now);
      const workspace = database.prepare("SELECT is_demo FROM workspaces WHERE id = ?").get(record.workspace_id);
      if (!workspace) throw new Error(`Workspace ${record.workspace_id} does not exist (foreign key).`);
      if (workspace.is_demo !== record.is_synthetic) throw new Error("Feedback and workspace synthetic/real markers must agree.");
      insertFeedback(database, record);
    } catch (error) {
      throw new Error(`Record ${index + 1} (id ${JSON.stringify(raw?.id) ?? "unknown"}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  database.exec("COMMIT");
  console.log(`Inserted ${input.length} feedback records. Source references are not automated proof of authenticity; human review is still required for real evidence.`);
} catch (error) {
  if (database.isTransaction) database.exec("ROLLBACK");
  throw error;
} finally { database.close(); }