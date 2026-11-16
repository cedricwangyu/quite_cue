import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDay, classifyPeriod, dayTypes, timePeriods, type NoiseFeedback } from "../src/lib/noise.ts";
import { estimateNoise } from "../src/server/noise-estimation.ts";

const now = new Date("2026-11-16T10:00:00.000Z");
const sample: NoiseFeedback = {
  id: 1, workspace_id: 1, noise_level: "Quiet", observed_at: "2026-11-16T09:00:00Z",
  submitted_at: "2026-11-16T09:30:00Z", source_type: "synthetic", is_synthetic: 1,
  review_status: "approved", source_reference: null,
};
const records = (count: number, changes: Partial<NoiseFeedback> = {}) =>
  Array.from({ length: count }, (_, index) => ({ ...sample, id: index + 1, ...changes }));
const estimate = (feedback: NoiseFeedback[]) => estimateNoise(1, feedback, "Weekday", "Morning", { now });

test("UTC day and period boundaries exclude overnight hours", () => {
  for (const [hour, expected] of [[0, null], [5, null], [6, "Morning"], [11, "Morning"], [12, "Afternoon"], [17, "Afternoon"], [18, "Evening"], [23, "Evening"]] as const) {
    assert.equal(classifyPeriod(new Date(`2026-11-16T${String(hour).padStart(2, "0")}:00:00Z`)), expected);
  }
  for (let offset = 0; offset < 7; offset++) {
    assert.equal(classifyDay(new Date(Date.UTC(2026, 10, 16 + offset))), offset < 5 ? "Weekday" : "Weekend");
  }
  assert.equal(classifyPeriod(new Date("2026-11-16T14:00:00+08:00")), "Morning");
});

test("sample count boundaries control confidence and suppress insufficient averages", () => {
  for (const count of [0, 1, 2, 3, 4, 5, 9, 10, 11]) {
    const result = estimate(records(count));
    assert.equal(result.sampleCount, count);
    assert.equal(result.confidenceLabel, count < 3 ? "Insufficient Data" : count < 5 ? "Low Confidence" : count < 10 ? "Medium Confidence" : "Higher Sample Confidence");
    assert.equal(result.average, count < 3 ? null : 1);
    assert.equal(result.estimatedNoiseLevel, count < 3 ? null : "Quiet");
  }
});

test("numeric noise mappings use exact 1.5 and 2.5 thresholds", () => {
  for (const [levels, average, expected] of [
    [["Quiet", "Quiet", "Quiet", "Moderate"], 1.25, "Quiet"],
    [["Quiet", "Quiet", "Moderate", "Moderate"], 1.5, "Moderate"],
    [["Moderate", "Moderate", "Moderate", "Lively"], 2.25, "Moderate"],
    [["Moderate", "Moderate", "Lively", "Lively"], 2.5, "Lively"],
    [["Lively", "Lively", "Lively", "Lively"], 3, "Lively"],
  ] as const) {
    const result = estimate(levels.map(noise_level => ({ ...sample, noise_level })));
    assert.equal(result.average, average);
    assert.equal(result.estimatedNoiseLevel, expected);
  }
});

test("filters reject stale, future, invalid, unapproved and other buckets without fallback", () => {
  const excluded: Partial<NoiseFeedback>[] = [
    { workspace_id: 2 }, { review_status: "pending" }, { review_status: "rejected" },
    { observed_at: "2026-11-17T09:00:00Z" }, { submitted_at: "2026-11-17T09:00:00Z" },
    { observed_at: "invalid" }, { submitted_at: "invalid" },
    { observed_at: "2026-08-18T09:59:59.999Z" },
    { observed_at: "2026-11-14T09:00:00Z" }, { observed_at: "2026-11-16T05:59:59Z" },
    { observed_at: "2026-11-13T12:00:00Z" }, { observed_at: "2026-11-13T18:00:00Z" },
    { is_synthetic: 0, source_type: "user_feedback", source_reference: null },
    { is_synthetic: 0, source_type: "field_observation", source_reference: "  " },
  ];
  const result = estimate(excluded.flatMap(changes => records(3, changes)));
  assert.equal(result.sampleCount, 0);
  assert.equal(result.lastUpdated, null);
  assert.equal(result.dataSource, "none");
  assert.equal(result.isSynthetic, false);
});

test("rolling history includes exact endpoints and supports configured duration", () => {
  const feedback = [
    { ...sample, observed_at: "2026-08-18T10:00:00Z" },
    { ...sample, observed_at: now.toISOString(), submitted_at: now.toISOString() },
    sample,
  ];
  assert.equal(estimate(feedback).sampleCount, 3);
  assert.equal(estimateNoise(1, feedback, "Weekday", "Morning", { now, historyDays: 1 }).sampleCount, 2);
  assert.equal(estimate(feedback).historyDays, 90);
});

test("matching samples determine sources, latest submission and deterministic output without mutation", () => {
  const real = { ...sample, is_synthetic: 0 as const, source_type: "field_observation" as const, source_reference: "field-1" };
  const feedback = [real, { ...sample, submitted_at: "2026-11-16T09:45:00Z" }, real];
  const before = structuredClone(feedback);
  const result = estimate(feedback);
  assert.equal(result.dataSource, "mixed");
  assert.equal(result.isSynthetic, true);
  assert.equal(result.lastUpdated, "2026-11-16T09:45:00.000Z");
  assert.equal(result.calculatedAt, now.toISOString());
  assert.deepEqual(result, estimate(feedback.toReversed()));
  assert.deepEqual(feedback, before);
  assert.equal(estimate([real]).dataSource, "real");
  assert.equal(estimate([real]).isSynthetic, false);
  assert.equal(estimate([sample]).dataSource, "synthetic");
  assert.equal(estimateNoise(1, feedback, "Weekday", "Morning", { now: () => now, isSynthetic: false }).sampleCount, 2);
  assert.equal(estimateNoise(1, feedback, "Weekday", "Morning", { now, isSynthetic: true }).sampleCount, 1);
});

test("each day and period selects only its exact bucket", () => {
  const feedback = dayTypes.flatMap((dayType, dayIndex) => timePeriods.flatMap((period, periodIndex) =>
    records(3, {
      observed_at: `2026-11-${dayType === "Weekday" ? "09" : "14"}T${["06", "12", "18"][periodIndex]}:00:00Z`,
      noise_level: period === "Morning" ? "Quiet" : period === "Afternoon" ? "Moderate" : "Lively",
      id: dayIndex * 3 + periodIndex + 1,
    })));
  for (const dayType of dayTypes) {
    for (const timePeriod of timePeriods) {
      const result = estimateNoise(1, feedback, dayType, timePeriod, { now });
      assert.equal(result.sampleCount, 3);
      assert.equal(result.dayType, dayType);
      assert.equal(result.timePeriod, timePeriod);
      assert.equal(result.estimatedNoiseLevel, timePeriod === "Morning" ? "Quiet" : timePeriod === "Afternoon" ? "Moderate" : "Lively");
    }
  }
});

test("lastUpdated uses submission order and sources ignore excluded samples", () => {
  const real = { ...sample, is_synthetic: 0 as const, source_type: "user_feedback" as const, source_reference: "feedback-1" };
  const result = estimate([
    real,
    { ...real, observed_at: "2026-11-13T06:00:00Z", submitted_at: now.toISOString() },
    { ...sample, review_status: "rejected" },
    { ...sample, observed_at: "2026-11-14T09:00:00Z" },
  ]);
  assert.equal(result.sampleCount, 2);
  assert.equal(result.lastUpdated, now.toISOString());
  assert.equal(result.dataSource, "real");
  assert.equal(result.isSynthetic, false);
  assert.equal(result.average, null);
  assert.equal(result.estimatedNoiseLevel, null);
});

test("invalid configuration is rejected and an injected clock is read once", () => {
  for (const historyDays of [0, -1, NaN, Infinity]) {
    assert.throws(() => estimateNoise(1, [], "Weekday", "Morning", { now, historyDays }), RangeError);
  }
  assert.throws(() => estimateNoise(1, [], "Weekday", "Morning", { now: new Date("invalid") }), RangeError);
  let calls = 0;
  const result = estimateNoise(1, [], "Weekday", "Morning", { now: () => { calls++; return now; } });
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    workspaceId: 1, estimatedNoiseLevel: null, sampleCount: 0, confidenceLabel: "Insufficient Data",
    timePeriod: "Morning", dayType: "Weekday", calculatedAt: now.toISOString(), lastUpdated: null,
    dataSource: "none", isSynthetic: false, historyDays: 90, average: null,
  });
});