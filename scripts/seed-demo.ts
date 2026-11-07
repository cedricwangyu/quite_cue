import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { databasePath } from "../src/server/database.ts";
import { createSchema, insertWorkspace } from "../src/server/schema.ts";
import { demoData } from "../src/server/demo-data.ts";

const path = databasePath();
mkdirSync(dirname(path), { recursive: true });
const database = new DatabaseSync(path);
try {
  createSchema(database);
  database.exec("BEGIN IMMEDIATE");
  database.exec("DELETE FROM workspaces WHERE is_demo = 1");
  for (const record of demoData) insertWorkspace(database, record);
  database.exec("COMMIT");
  console.log("Demo initialized: 11 public fictional records + 1 unpublished fixture. No real records replaced.");
} catch (error) {
  if (database.isTransaction) database.exec("ROLLBACK");
  throw error;
} finally { database.close(); }