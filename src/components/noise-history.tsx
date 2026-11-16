"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Volume2 } from "lucide-react";
import { dayTypes, historicalNotice, syntheticNotice, timePeriods, type DayType, type NoiseEstimate, type TimePeriod } from "../lib/noise";

interface HistoryResult {
  estimate: NoiseEstimate;
  overview: NoiseEstimate[];
  notices: string[];
}

export function NoiseHistory({ workspaceId, isSynthetic }: { workspaceId: number; isSynthetic: boolean }) {
  const [dayType, setDayType] = useState<DayType>("Weekday");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("Morning");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workspaces/${workspaceId}/noise-estimate?${new URLSearchParams({ dayType, timePeriod })}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unavailable");
        const data: HistoryResult = await response.json();
        if (!controller.signal.aborted) { setResult(data); setStatus("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [workspaceId, dayType, timePeriod, retry]);

  const estimate = result?.estimate;
  return <section className="detail-section noise-history" aria-labelledby="noise-history-title">
    <div className="noise-heading"><h2 id="noise-history-title"><Volume2 size={20} aria-hidden="true" />Historical Noise Estimation</h2>{isSynthetic && <span className="detail-demo">Synthetic Data</span>}</div>
    <div className="noise-controls">
      <label htmlFor="noise-day">Day type (UTC)<select id="noise-day" value={dayType} onChange={event => { if (event.target.value !== dayType) { setStatus("loading"); setDayType(event.target.value as DayType); } }}>{dayTypes.map(day => <option key={day}>{day}</option>)}</select></label>
      <label htmlFor="noise-period">Time period (UTC)<select id="noise-period" value={timePeriod} onChange={event => { if (event.target.value !== timePeriod) { setStatus("loading"); setTimePeriod(event.target.value as TimePeriod); } }}>{timePeriods.map(period => <option key={period}>{period}</option>)}</select></label>
    </div>
    <div className="noise-result" aria-live="polite" aria-busy={status === "loading"}>
      {status === "loading" && <p role="status">Loading historical noise estimate...</p>}
      {status === "error" && <div role="alert" className="noise-error"><AlertCircle size={20} /><p>Historical noise estimates temporarily unavailable.</p><button className="primary-button" onClick={() => { setStatus("loading"); setRetry(value => value + 1); }}><RefreshCw size={15} />Retry</button></div>}
      {status === "ready" && estimate && <>
        <div className="noise-summary"><div><span className="field-label">Estimated Noise Level</span><strong className={`noise-level noise-${estimate.estimatedNoiseLevel?.toLowerCase() ?? "unknown"}`}>{estimate.estimatedNoiseLevel ?? "Insufficient Data"}</strong></div><div><span className="field-label">Sample Confidence</span><strong>{estimate.confidenceLabel}</strong></div></div>
        {!estimate.estimatedNoiseLevel && <p className="noise-insufficient">Not enough historical feedback to estimate noise for this period.</p>}
        <dl className="noise-metadata">
          <div><dt>Feedback Samples</dt><dd data-testid="noise-sample-count">{estimate.sampleCount}</dd></div>
          <div><dt>Period</dt><dd>{estimate.dayType} / {estimate.timePeriod} (UTC)</dd></div>
          <div><dt>Data Source</dt><dd>{estimate.dataSource === "synthetic" ? "Synthetic historical feedback" : estimate.dataSource === "real" ? "Reviewed historical feedback" : estimate.dataSource === "mixed" ? "Mixed historical feedback" : "No matching feedback"}</dd></div>
          <div><dt>Last Updated</dt><dd>{estimate.lastUpdated ? `${estimate.lastUpdated.replace("T", " ").slice(0, 19)} UTC` : "No matching feedback"}</dd></div>
          <div><dt>History Window</dt><dd>Past {estimate.historyDays} days</dd></div>
          <div><dt>Calculated At</dt><dd>{estimate.calculatedAt.replace("T", " ").slice(0, 19)} UTC</dd></div>
        </dl>
        <figure className="noise-overview"><figcaption>{dayType} Historical Overview (UTC)</figcaption><ul>{result.overview.map(period => <li key={period.timePeriod} aria-current={period.timePeriod === timePeriod ? "true" : undefined}><span>{period.timePeriod}</span><meter min={1} max={3} value={period.average ?? 1} aria-label={`${period.timePeriod} mean noise score`} aria-valuetext={period.average === null ? "Insufficient Data" : `${period.average.toFixed(2)} out of 3`} className={period.average === null ? "no-samples" : ""} /><strong>{period.estimatedNoiseLevel ?? "Insufficient Data"}</strong><small>{period.sampleCount} samples</small></li>)}</ul></figure>
      </>}
    </div>
    <p className="source-footnote">{historicalNotice}<br />{isSynthetic || estimate?.isSynthetic ? syntheticNotice : null}</p>
    <p className="source-footnote">Confidence labels describe sample counts, not validated statistical accuracy. Historical estimates do not change task rankings.</p>
  </section>;
}