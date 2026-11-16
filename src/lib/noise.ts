import type { Workspace } from "./model.ts";

export const dayTypes = ["Weekday", "Weekend"] as const;
export const timePeriods = ["Morning", "Afternoon", "Evening"] as const;
export const sourceTypes = ["synthetic", "field_observation", "user_feedback"] as const;
export const reviewStatuses = ["pending", "approved", "rejected"] as const;
export type DayType = typeof dayTypes[number];
export type TimePeriod = typeof timePeriods[number];
export type NoiseLevel = NonNullable<Workspace["noise_level"]>;
export interface NoiseFeedback {
  id: number;
  workspace_id: number;
  noise_level: NoiseLevel;
  observed_at: string;
  submitted_at: string;
  source_type: typeof sourceTypes[number];
  is_synthetic: 0 | 1;
  review_status: typeof reviewStatuses[number];
  source_reference: string | null;
}
export type ConfidenceLabel = "Insufficient Data" | "Low Confidence" | "Medium Confidence" | "Higher Sample Confidence";
export interface NoiseEstimate {
  workspaceId: number;
  estimatedNoiseLevel: NoiseLevel | null;
  sampleCount: number;
  confidenceLabel: ConfidenceLabel;
  timePeriod: TimePeriod;
  dayType: DayType;
  calculatedAt: string;
  lastUpdated: string | null;
  dataSource: "synthetic" | "real" | "mixed" | "none";
  isSynthetic: boolean;
  historyDays: number;
  average: number | null;
}
export const historicalNotice = "Estimated from historical feedback — not a real-time measurement.";
export const syntheticNotice = "Based on synthetic demonstration data.";

export function classifyDay(date: Date): DayType {
  return [0, 6].includes(date.getUTCDay()) ? "Weekend" : "Weekday";
}

export function classifyPeriod(date: Date): TimePeriod | null {
  const hour = date.getUTCHours();
  return hour < 6 ? null : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
}