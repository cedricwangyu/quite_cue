import { noiseLevels } from "../lib/model.ts";
import { reviewStatuses, sourceTypes, type NoiseFeedback } from "../lib/noise.ts";
import { feedbackColumns } from "./synthetic-feedback.ts";

export function normalizeTimestamp(input: unknown, field = "timestamp"): string {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input)) {
    throw new Error(`Invalid ${field}: expected UTC YYYY-MM-DDTHH:mm:ss.sssZ (seconds Z also accepted).`);
  }
  const canonical = input.length === 20 ? input.replace("Z", ".000Z") : input;
  const date = new Date(canonical);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== canonical) throw new Error(`Invalid ${field}: invalid calendar date or time.`);
  return canonical;
}

export function validateNoiseFeedback(input: unknown, now = new Date()): NoiseFeedback {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid reference time.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Record must be an object.");
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) if (!(feedbackColumns as readonly string[]).includes(key)) throw new Error(`Unknown field: ${key}.`);
  for (const key of feedbackColumns) if (!Object.hasOwn(record, key)) throw new Error(`Missing field: ${key}.`);
  for (const key of ["id", "workspace_id"] as const) {
    if (!Number.isSafeInteger(record[key]) || (record[key] as number) < 1) throw new Error(`Invalid ${key}: expected a safe positive integer.`);
  }
  for (const [key, values] of [["noise_level", noiseLevels], ["source_type", sourceTypes], ["review_status", reviewStatuses]] as const) {
    if (!(values as readonly unknown[]).includes(record[key])) throw new Error(`Invalid ${key}.`);
  }
  if (record.is_synthetic !== 0 && record.is_synthetic !== 1) throw new Error("Invalid is_synthetic flag.");
  if ((record.source_type === "synthetic") !== (record.is_synthetic === 1)) throw new Error("source_type and is_synthetic must agree.");
  const reference = record.source_reference;
  if (reference !== null && (typeof reference !== "string" || !reference.trim() || reference.length > 4000)) throw new Error("Invalid source_reference.");
  if (record.is_synthetic === 0 && record.review_status === "approved" && reference === null) throw new Error("Approved real feedback requires a source_reference; human evidence review is still required.");
  const observed = normalizeTimestamp(record.observed_at, "observed_at");
  const submitted = normalizeTimestamp(record.submitted_at, "submitted_at");
  if (observed > submitted || new Date(submitted).getTime() > now.getTime()) throw new Error("Timestamps must satisfy observed_at <= submitted_at <= now.");
  return { ...record, observed_at: observed, submitted_at: submitted } as unknown as NoiseFeedback;
}