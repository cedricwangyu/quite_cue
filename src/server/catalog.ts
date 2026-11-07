import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Filters, Workspace } from "../lib/model.ts";
import { rankWorkspaces } from "../lib/ranking.ts";
import { withDatabase } from "./database.ts";

export function searchWorkspaces(filters: Filters, database?: DatabaseSync) {
  const operation = (connection: DatabaseSync) => {
    const clauses = ["published = 1"];
    const values: SQLInputValue[] = [];
    if (filters.search) {
      connection.function("casefold", { deterministic: true }, value => typeof value === "string" ? value.toLowerCase() : "");
      const search = `%${filters.search.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
      clauses.push("(casefold(name) LIKE ? ESCAPE '\\' OR casefold(area) LIKE ? ESCAPE '\\')");
      values.push(search, search);
    }
    for (const [filterKey, column] of [["category", "category"], ["noise", "noise_level"], ["cost", "cost_band"]] as const) {
      if (filters[filterKey]) { clauses.push(`${column} = ?`); values.push(filters[filterKey]); }
    }
    for (const [filterKey, column] of [["wifi", "wifi"], ["outlets", "outlets"], ["group", "group_friendly"]] as const) {
      if (filters[filterKey]) { clauses.push(`${column} = ?`); values.push(1); }
    }
    const rows = connection.prepare(`SELECT * FROM workspaces WHERE ${clauses.join(" AND ")}`).all(...values) as unknown as Workspace[];
    return rankWorkspaces(rows, filters.task);
  };
  return database ? operation(database) : withDatabase(operation);
}

export function getWorkspace(id: number, database?: DatabaseSync): Workspace | null {
  const operation = (connection: DatabaseSync) => (connection.prepare("SELECT * FROM workspaces WHERE id = ? AND published = 1").get(id) as unknown as Workspace | undefined) ?? null;
  return database ? operation(database) : withDatabase(operation);
}