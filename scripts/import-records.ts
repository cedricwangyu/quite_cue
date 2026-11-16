import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { databasePath } from "../src/server/database.ts";
import { columns, createSchema } from "../src/server/schema.ts";
import { validateRealRecord, validateSyntheticRecord } from "../src/server/data-validation.ts";

const { values, positionals } = parseArgs({ options: { synthetic: { type: "boolean", default: false } }, allowPositionals: true });
const filename = positionals[0];
if (!filename || positionals.length !== 1) throw new Error("Usage: node --experimental-strip-types scripts/import-records.ts [--synthetic] path/to/records.json");
const input: unknown = JSON.parse(readFileSync(filename, "utf8"));
if (!Array.isArray(input)) throw new Error("Import must be a JSON array.");
const path = databasePath();
mkdirSync(dirname(path), { recursive: true });
const database = new DatabaseSync(path);
try {
  createSchema(database);
  database.exec("BEGIN IMMEDIATE");
  const updates = columns.filter(column => column !== "id" && column !== "is_demo");
  const upsert = database.prepare(`INSERT INTO workspaces (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${updates.map(column => `${column}=excluded.${column}`).join(",")}`);
  const seen = new Set<number>();
  const now = new Date();
  for (const [index, raw] of input.entries()) {
    try {
      const record = (values.synthetic ? validateSyntheticRecord : validateRealRecord)(raw, now);
      if (seen.has(record.id)) throw new Error("Duplicate ID in import.");
      seen.add(record.id);
      const existing = database.prepare("SELECT is_demo FROM workspaces WHERE id = ?").get(record.id);
      if (existing && existing.is_demo !== record.is_demo) throw new Error("ID conflicts with the opposite synthetic/real marker; choose another ID.");
      upsert.run(...columns.map(column => record[column]));
    } catch (error) {
      throw new Error(`Record ${index + 1} (id ${JSON.stringify(raw?.id) ?? "unknown"}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  database.exec("COMMIT");
  console.log(values.synthetic ? `Imported ${input.length} synthetic workspace records. No real collection or verification is represented.` : `Imported ${input.length} validated real records. Human evidence review is still required.`);
} catch (error) {
  if (database.isTransaction) database.exec("ROLLBACK");
  throw error;
} finally { database.close(); }