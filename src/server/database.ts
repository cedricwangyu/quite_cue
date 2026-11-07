import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

export function databasePath(): string {
  return process.env.QUIET_CUE_DB_PATH ?? resolve(process.cwd(), "data", "quiet-cue.sqlite");
}

export function withDatabase<Result>(operation: (database: DatabaseSync) => Result): Result {
  const database = new DatabaseSync(databasePath(), { readOnly: true });
  try { return operation(database); } finally { database.close(); }
}