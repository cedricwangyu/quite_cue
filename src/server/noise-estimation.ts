import {
  classifyDay, classifyPeriod, historicalNotice, syntheticNotice, timePeriods,
  type DayType, type NoiseEstimate, type NoiseFeedback, type TimePeriod,
} from "../lib/noise.ts";
import { getWorkspace } from "./catalog.ts";
import { withDatabase } from "./database.ts";

export interface NoiseEstimationOptions {
  historyDays?: number;
  now?: Date | (() => Date);
}

export interface EstimateNoiseOptions extends NoiseEstimationOptions {
  isSynthetic?: boolean;
}

export interface NoiseEstimationResult {
  estimate: NoiseEstimate;
  overview: NoiseEstimate[];
  notices: string[];
}

function resolveOptions(options: NoiseEstimationOptions) {
  const historyDays = options.historyDays ?? 90;
  const now = typeof options.now === "function" ? options.now() : options.now ?? new Date();
  if (!Number.isFinite(historyDays) || historyDays <= 0 || !Number.isFinite(now.getTime())) {
    throw new RangeError("Invalid noise estimation options.");
  }
  return { historyDays, now: new Date(now.getTime()) };
}

export function estimateNoise(
  workspaceId: number,
  feedback: readonly NoiseFeedback[],
  dayType: DayType,
  timePeriod: TimePeriod,
  options: EstimateNoiseOptions = {},
): NoiseEstimate {
  const { historyDays, now } = resolveOptions(options);
  const latest = now.getTime();
  const earliest = latest - historyDays * 86_400_000;
  const samples = feedback.filter(record => {
    if (record.workspace_id !== workspaceId || record.review_status !== "approved") return false;
    if (options.isSynthetic !== undefined && Boolean(record.is_synthetic) !== options.isSynthetic) return false;
    if (record.is_synthetic === 0 && !record.source_reference?.trim()) return false;
    const observed = Date.parse(record.observed_at);
    const submitted = Date.parse(record.submitted_at);
    return Number.isFinite(observed) && Number.isFinite(submitted)
      && observed >= earliest && observed <= latest && submitted <= latest
      && classifyDay(new Date(observed)) === dayType && classifyPeriod(new Date(observed)) === timePeriod;
  });
  const sampleCount = samples.length;
  const hasSynthetic = samples.some(record => record.is_synthetic === 1);
  const hasReal = samples.some(record => record.is_synthetic === 0);
  const scores = { Quiet: 1, Moderate: 2, Lively: 3 } as const;
  const average = sampleCount >= 3
    ? samples.reduce((total, record) => total + scores[record.noise_level], 0) / sampleCount
    : null;
  return {
    workspaceId,
    estimatedNoiseLevel: average === null ? null : average < 1.5 ? "Quiet" : average < 2.5 ? "Moderate" : "Lively",
    sampleCount,
    confidenceLabel: sampleCount < 3 ? "Insufficient Data" : sampleCount < 5 ? "Low Confidence"
      : sampleCount < 10 ? "Medium Confidence" : "Higher Sample Confidence",
    timePeriod,
    dayType,
    calculatedAt: now.toISOString(),
    lastUpdated: sampleCount ? new Date(samples.reduce((latestSubmission, record) =>
      Math.max(latestSubmission, Date.parse(record.submitted_at)), -Infinity)).toISOString() : null,
    dataSource: hasSynthetic ? hasReal ? "mixed" : "synthetic" : hasReal ? "real" : "none",
    isSynthetic: hasSynthetic,
    historyDays,
    average,
  };
}

export class NoiseEstimationService {
  private readonly options: NoiseEstimationOptions;

  constructor(options: NoiseEstimationOptions = {}) {
    this.options = { ...options };
  }

  estimate(workspaceId: number, dayType: DayType = "Weekday", timePeriod: TimePeriod = "Morning"): NoiseEstimationResult | null {
    const options = resolveOptions(this.options);
    return withDatabase(database => {
      database.exec("BEGIN");
      try {
        const workspace = getWorkspace(workspaceId, database);
        if (!workspace) return null;
        const feedback = database.prepare(`SELECT * FROM noise_feedback
          WHERE workspace_id = ? AND review_status = 'approved' AND is_synthetic = ?`)
          .all(workspaceId, workspace.is_demo) as unknown as NoiseFeedback[];
        const overview = timePeriods.map(period => estimateNoise(workspaceId, feedback, dayType, period, {
          ...options, isSynthetic: workspace.is_demo === 1,
        }));
        return {
          estimate: overview[timePeriods.indexOf(timePeriod)],
          overview,
          notices: [historicalNotice, ...(overview.some(estimate => estimate.isSynthetic) ? [syntheticNotice] : [])],
        };
      } finally {
        database.exec("ROLLBACK");
      }
    });
  }

  overview(workspaceId: number, dayType: DayType = "Weekday"): NoiseEstimate[] | null {
    return this.estimate(workspaceId, dayType)?.overview ?? null;
  }
}