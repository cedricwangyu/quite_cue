import type { DatabaseSync } from "node:sqlite";
import type { Workspace } from "../lib/model.ts";
import { classifyDay, type NoiseFeedback, type NoiseLevel } from "../lib/noise.ts";

export const feedbackColumns = ["id", "workspace_id", "noise_level", "observed_at", "submitted_at", "source_type", "is_synthetic", "review_status", "source_reference"] as const;

export function insertFeedback(database: DatabaseSync, feedback: NoiseFeedback): void {
  database.prepare(`INSERT INTO noise_feedback (${feedbackColumns.join(",")}) VALUES (${feedbackColumns.map(() => "?").join(",")})`).run(...feedbackColumns.map(column => feedback[column]));
}

export function generateSyntheticFeedback(workspaces: Workspace[], seed = 2101, now = new Date()): NoiseFeedback[] {
  if (!Number.isSafeInteger(seed) || !Number.isFinite(now.getTime())) throw new Error("Invalid generator seed or date.");
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const records: NoiseFeedback[] = [];
  for (const workspace of workspaces.filter(record => record.is_demo === 1)) {
    for (const weekend of [false, true]) {
      for (const hour of [9, 14, 20]) {
        const samples = workspace.id === 10 ? 2 : 5;
        for (let sample = 0; sample < samples; sample++) {
          const observed = new Date(now);
          observed.setUTCDate(observed.getUTCDate() - 1 - sample * 7);
          observed.setUTCHours(hour, Math.floor(random() * 60), 0, 0);
          while ((classifyDay(observed) === "Weekend") !== weekend) observed.setUTCDate(observed.getUTCDate() - 1);
          const baseline = workspace.category === "Library" ? 1 : workspace.category === "Café" ? 2.5 : workspace.category === "Coworking Space" ? 1.5 : 2;
          const value = baseline + (hour === 14 ? 0.6 : hour === 20 ? -0.3 : 0) + (weekend ? 0.3 : 0) + (random() - 0.5) * 1.6;
          const noise: NoiseLevel = value < 1.5 ? "Quiet" : value < 2.5 ? "Moderate" : "Lively";
          records.push({ id: records.length + 1, workspace_id: workspace.id, noise_level: noise, observed_at: observed.toISOString(), submitted_at: new Date(observed.getTime() + 60000).toISOString(), source_type: "synthetic", is_synthetic: 1, review_status: "approved", source_reference: `Synthetic generator seed ${seed}; no real observation` });
        }
      }
    }
    for (const review of ["pending", "rejected"] as const) {
      const observed = new Date(now.getTime() - (review === "pending" ? 3600000 : 7200000));
      records.push({ id: records.length + 1, workspace_id: workspace.id, noise_level: "Lively", observed_at: observed.toISOString(), submitted_at: now.toISOString(), source_type: "synthetic", is_synthetic: 1, review_status: review, source_reference: `Synthetic ${review} anomaly fixture; excluded from estimates` });
    }
  }
  return records;
}

export function replaceSyntheticFeedback(database: DatabaseSync, records: NoiseFeedback[]): void {
  database.exec("DELETE FROM noise_feedback WHERE is_synthetic = 1");
  const maximum = Number(database.prepare("SELECT coalesce(max(id), 0) AS id FROM noise_feedback").get()!.id);
  for (const [index, record] of records.entries()) insertFeedback(database, { ...record, id: maximum + index + 1 });
}