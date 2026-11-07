import type { DatabaseSync } from "node:sqlite";
import type { Workspace } from "../lib/model.ts";

export const columns = ["id", "name", "category", "area", "address", "description", "noise_level", "wifi", "outlets", "group_friendly", "cost_band", "opening_hours", "collection_method", "source_note", "observation_ref", "source_url", "last_verified_date", "published", "is_demo"] as const;

export function createSchema(database: DatabaseSync): void {
  database.exec(`CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY CHECK(id > 0),
    name TEXT NOT NULL CHECK(length(trim(name)) > 0),
    category TEXT NOT NULL CHECK(category IN ('Library','Café','Coworking Space','Campus Study Area','Other')),
    area TEXT NOT NULL, address TEXT NOT NULL, description TEXT,
    noise_level TEXT CHECK(noise_level IN ('Quiet','Moderate','Lively')),
    wifi INTEGER CHECK(wifi IN (0,1)), outlets INTEGER CHECK(outlets IN (0,1)), group_friendly INTEGER CHECK(group_friendly IN (0,1)),
    cost_band TEXT CHECK(cost_band IN ('Free','Low','Medium','High')),
    opening_hours TEXT,
    collection_method TEXT CHECK(collection_method IN ('Field Observation','Online Source','Both')),
    source_note TEXT, observation_ref TEXT, source_url TEXT, last_verified_date TEXT,
    published INTEGER NOT NULL CHECK(published IN (0,1)),
    is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1))
  ); CREATE INDEX IF NOT EXISTS workspaces_published ON workspaces(published);`);
}

export function insertWorkspace(database: DatabaseSync, workspace: Workspace): void {
  database.prepare(`INSERT INTO workspaces (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...columns.map(column => workspace[column]));
}