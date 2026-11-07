import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databasePath } from "../src/server/database.ts";
import { createSchema, insertWorkspace } from "../src/server/schema.ts";
import { validateRealRecord } from "../src/server/data-validation.ts";

const filename = process.argv[2];
if (!filename) throw new Error("Usage: npm run db:import -- path/to/records.json");
const input: unknown = JSON.parse(readFileSync(filename, "utf8"));
if (!Array.isArray(input)) throw new Error("Import must be a JSON array.");
const records = input.map(record => validateRealRecord(record));
if (new Set(records.map(record => record.id)).size !== records.length) throw new Error("Duplicate IDs in import.");
const path = databasePath();
mkdirSync(dirname(path), { recursive: true });
const database = new DatabaseSync(path);
try {
  createSchema(database);
  database.exec("BEGIN IMMEDIATE");
  for (const record of records) {
    const existing = database.prepare("SELECT is_demo FROM workspaces WHERE id = ?").get(record.id);
    if (existing?.is_demo === 1) throw new Error("Import ID conflicts with a Demo record; choose another ID.");
    database.prepare("DELETE FROM workspaces WHERE id = ? AND is_demo = 0").run(record.id);
    insertWorkspace(database, record);
  }
  database.exec("COMMIT");
  console.log(`Imported ${records.length} validated real records. Human evidence review is still required.`);
} catch (error) {
  if (database.isTransaction) database.exec("ROLLBACK");
  throw error;
} finally { database.close(); }