import { categories, collectionMethods, costBands, noiseLevels, type Workspace } from "../lib/model.ts";
import { validDate } from "../lib/freshness.ts";
import { columns } from "./schema.ts";

export function validateRealRecord(input: unknown, now = new Date()): Workspace {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Record must be an object.");
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) if (!(columns as readonly string[]).includes(key)) throw new Error(`Unknown field: ${key}.`);
  for (const key of columns) if (!(key in record)) throw new Error(`Missing field: ${key}.`);
  if (!Number.isSafeInteger(record.id) || (record.id as number) < 1) throw new Error("Invalid ID.");
  if (record.is_demo !== 0) throw new Error("Real import cannot contain Demo Data.");
  if (record.published !== 0 && record.published !== 1) throw new Error("Invalid published flag.");
  for (const key of ["name", "area", "address"] as const) {
    if (typeof record[key] !== "string" || !(record[key] as string).trim() || (record[key] as string).length > 300) throw new Error(`Invalid ${key}.`);
  }
  for (const key of ["description", "opening_hours", "source_note", "observation_ref", "source_url", "last_verified_date"] as const) {
    if (record[key] !== null && (typeof record[key] !== "string" || !(record[key] as string).trim() || (record[key] as string).length > 4000)) throw new Error(`Invalid ${key}.`);
  }
  for (const [key, values, nullable] of [["category", categories, false], ["noise_level", noiseLevels, true], ["cost_band", costBands, true], ["collection_method", collectionMethods, true]] as const) {
    if (!(nullable && record[key] === null) && !(values as readonly unknown[]).includes(record[key])) throw new Error(`Invalid ${key}.`);
  }
  for (const key of ["wifi", "outlets", "group_friendly"] as const) if (record[key] !== null && record[key] !== 0 && record[key] !== 1) throw new Error(`Invalid ${key}.`);
  if (record.source_url !== null) {
    let url: URL;
    try { url = new URL(record.source_url as string); } catch { throw new Error("Invalid source URL."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Source URL must be HTTP(S), without credentials.");
  }
  if (record.last_verified_date !== null && (!validDate(record.last_verified_date as string) || (record.last_verified_date as string) > now.toISOString().slice(0, 10))) throw new Error("Invalid or future verification date.");
  if (record.published === 1) {
    if (!record.description || !record.collection_method || !record.source_note || !record.last_verified_date) throw new Error("Published records require description, collection method, source note and verification date.");
    if ((record.collection_method === "Field Observation" || record.collection_method === "Both") && !record.observation_ref) throw new Error("Field observations require an observation reference.");
    if ((record.collection_method === "Online Source" || record.collection_method === "Both") && !record.source_url) throw new Error("Online sources require a source URL.");
  }
  return record as unknown as Workspace;
}