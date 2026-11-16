# Historical Noise Estimation (V0.2)

## Scope and Evidence

This is a working course demonstration using Synthetic workspace and feedback data only. No real observations, venue investigation, user submissions, human evidence review, or source authenticity verification have occurred. Synthetic `approved` rows are calculation fixtures, not proof of human moderation. Historical estimates are not live measurements, ML output, validated predictions, or a change to existing task rankings.

The detail panel supports Weekday/Weekend and Morning/Afternoon/Evening selection, sample counts, count-based confidence, source/timestamp metadata, and a three-period historical overview. Bars are computed from the same eligible historical feedback as the selected estimate. Loading, error/retry, and Insufficient Data states are explicit. Re-selecting the current option must not leave the panel stuck loading.

## Eligibility and Buckets

The public service first resolves a published workspace, then reads approved feedback matching its ID and Synthetic marker. `workspaces.is_demo` is the preserved legacy Synthetic marker; feedback has explicit `is_synthetic` and `source_type`. Synthetic and real sources are not pooled by the public service. The low-level calculation type can describe `mixed`, but that is not a public-service mixing policy.

The default window is the past 90 elapsed days: `now - 90 * 86,400,000 <= observed_at <= now`. Submitted timestamps must also be valid and no later than `now`. Import validation additionally guarantees `observed_at <= submitted_at`. Pending/rejected records, future observations/submissions, expired observations, and wrong-workspace/source records are excluded. Approved real feedback without a nonblank source reference is also excluded.

Buckets use **observation time in UTC**, not submission time, the browser timezone, or local opening hours:

| Dimension | Exact membership |
| --- | --- |
| Weekday | Monday-Friday |
| Weekend | Saturday-Sunday |
| Morning | 06:00 inclusive to 12:00 exclusive |
| Afternoon | 12:00 inclusive to 18:00 exclusive |
| Evening | 18:00 inclusive to 24:00 exclusive |
| Overnight | 00:00 inclusive to 06:00 exclusive; excluded from every period |

Only the selected day-type/period pair contributes. No cross-period, cross-day-type, or other-workspace fallback is used.

## Calculation

Quiet = 1, Moderate = 2, and Lively = 3. With at least three eligible samples, take their arithmetic mean:

| Mean | Estimated level |
| --- | --- |
| Below 1.5 | Quiet |
| At least 1.5 and below 2.5 | Moderate |
| At least 2.5 | Lively |

| Sample count | Confidence label |
| --- | --- |
| 0-2 | Insufficient Data |
| 3-4 | Low Confidence |
| 5-9 | Medium Confidence |
| 10 or more | Higher Sample Confidence |

For fewer than three samples, both `average` and `estimatedNoiseLevel` are `null`; the actual sample count is retained. Confidence describes sample quantity only, not validated statistical or predictive accuracy. These ordinal scores are a transparent demonstration heuristic, not calibrated sound-pressure measurements.

## Read-Only API

```text
GET /api/workspaces/[id]/noise-estimate?dayType=Weekday&timePeriod=Morning
```

Only `dayType` and `timePeriod` are allowed. Values are case-sensitive: `Weekday`/`Weekend` and `Morning`/`Afternoon`/`Evening`. Omitted values default independently to `Weekday` and `Morning`. Empty values, unknown keys, duplicate keys, invalid enums, and malformed/nonpositive IDs are rejected.

The successful response has exactly these top-level members:

```text
{ estimate: NoiseEstimate, overview: NoiseEstimate[], notices: string[] }
```

`estimate` is the selected bucket. `overview` contains Morning, Afternoon, Evening in that order for the selected day type, all calculated from one database snapshot and reference time.

| Estimate field | Meaning |
| --- | --- |
| `workspaceId` | Requested public workspace ID |
| `estimatedNoiseLevel` | Quiet, Moderate, Lively, or null |
| `sampleCount` | Eligible samples in this exact bucket |
| `confidenceLabel` | Count-based label from the table above |
| `dayType`, `timePeriod` | Selected UTC bucket |
| `calculatedAt` | Calculation reference timestamp, not observation time |
| `lastUpdated` | Latest eligible submission timestamp, or null for zero samples |
| `dataSource` | `synthetic`, `real`, or `none` in this source-isolated service |
| `isSynthetic` | Whether eligible samples include Synthetic feedback |
| `historyDays` | 90 by default; not a public query parameter |
| `average` | Mean ordinal score, or null below three samples |

An insufficient bucket with one or two samples still has source and last-update metadata. An empty bucket uses `dataSource: "none"`, `isSynthetic: false`, and `lastUpdated: null`; the page still identifies its workspace as Synthetic. Notices state that results are historical, not real-time, and add a Synthetic notice when an overview bucket contains Synthetic samples. All responses use `Cache-Control: no-store`.

| HTTP status | Condition |
| --- | --- |
| 200 | Published workspace, including insufficient/empty buckets |
| 400 | Invalid ID or query; generic invalid-parameters error |
| 404 | Missing or unpublished workspace; same not-found error |
| 503 | Read/database failure; generic temporarily-unavailable error |
| 405 | Unsupported write method, including POST/PUT/PATCH/DELETE |

Errors do not return database paths, SQL, stack traces, or raw feedback rows. The service uses a read-only database connection and a read transaction; it never creates feedback or changes workspace attributes. There is no public feedback submission or moderation API.

## Schema and Import Contracts

`noise_feedback` contains `id`, `workspace_id`, `noise_level`, `observed_at`, `submitted_at`, `source_type`, `is_synthetic`, `review_status`, and nullable `source_reference`. Every field must appear in imported JSON; unknown fields are rejected. IDs must be positive safe integers. `source_type` is `synthetic`, `field_observation`, or `user_feedback`; `review_status` is `pending`, `approved`, or `rejected`. The source type is Synthetic if and only if `is_synthetic = 1`.

Feedback timestamps accept canonical UTC `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DDTHH:mm:ss.sssZ` only. Seconds normalize to three-digit milliseconds. Invalid calendar dates, timezone offsets, missing `Z`, noncanonical fractions, and future submissions are rejected. Ordering must satisfy `observed_at <= submitted_at <= now`.

The database enforces unique feedback IDs, unique `(workspace_id, observed_at, source_type)`, enum/marker checks, and a workspace foreign key with `ON DELETE RESTRICT`. Import also requires workspace/feedback Synthetic markers to match. Indexes are `(workspace_id, review_status, observed_at)`, `observed_at`, and `review_status`.

Workspace import uses an atomic in-place upsert, preserving foreign-key dependents and the existing Synthetic marker. Duplicate IDs in one batch or an opposite-marker ID conflict reject it. Feedback import is atomic **insert only**, not update/upsert: duplicate IDs or natural keys, invalid references, or any invalid row roll back the whole batch. No partial import remains.

Approved real feedback would require a nonblank `source_reference`; this is only a field constraint. Any future real evidence requires actual human review before approval, and passing validation cannot prove its authenticity. The real-workspace template is a future format example, not actual venue data.

## Synthetic Commands

Run from the repository root; use `npm.cmd` in Windows PowerShell. Shared setup and database-path instructions remain in [../README.md](../README.md).

```sh
npm run db:demo
npm run db:demo -- --seed 2101 --now 2026-11-16T12:00:00.000Z
npm run db:import -- --synthetic data/synthetic-workspaces.template.json
npm run db:feedback:import -- data/noise-feedback.template.json
npm run db:synthetic -- --seed 2101 --now 2026-11-16T12:00:00Z
npm run db:synthetic -- --clear
```

- `db:demo` replaces Synthetic demo workspaces and their Synthetic feedback in one transaction. Defaults produce 12 workspaces (11 public, one unpublished) and 366 feedback rows: 342 approved plus 12 pending and 12 rejected fixtures. Each workspace has one pending and one rejected row, excluded from estimates.
- Cloudberry, workspace ID 10, has two approved records per bucket across six day-type/period combinations and intentionally remains insufficient. The other 11 workspaces each have five approved records per bucket.
- `--seed` defaults to 2101; `--now` defaults to the current time. Reference timestamps follow the canonical UTC rules above. The PRNG uses 32-bit state (`seed >>> 0`), so distinct safe-integer seeds can share that state. Reproduction requires the same seed, reference date/time, and ordered workspace list; a seed alone does not fix output dates. Stored feedback IDs can also depend on retained real feedback IDs.
- Approved fixtures use days before the reference time, weekly spacing, and backward day-type adjustment, spanning up to roughly a month. They are invented values, not sampled venues. Fixed seeds/dates age out of the rolling window; rerun with a current reference time for demonstrations.
- The Synthetic workspace template explicitly uses `is_demo: 1`. Import it before its feedback template, which explicitly uses `source_type: "synthetic"` and `is_synthetic: 1`. The template's fixed January feedback date may already be outside the window. Repeating feedback import is not idempotent and fails uniqueness checks.
- `db:synthetic` regenerates **feedback only** for all current `is_demo = 1` workspaces, replacing existing Synthetic feedback. It does not reset or create workspace records. Custom workspace lists change the generated count and sequence.
- `db:synthetic -- --clear` removes Synthetic feedback then Synthetic workspaces. Real records are retained. Any retained feedback dependency prevents workspace deletion via RESTRICT and rolls back the transaction. Seeding likewise fails safely on ID conflicts or restricted dependencies.

## Verification and Limitations

Final V0.2 checks passed 45 Node tests and 28 full-suite browser tests on desktop/mobile-sized Chromium, including ten historical-noise browser checks. TypeScript, ESLint, production build and dependency audit also passed. Full evidence is tracked in [VERIFICATION.md](VERIFICATION.md). The focused run initially exposed a repeated-selection loading bug, which was corrected and rerun successfully as recorded in [AI_CORRECTION_LOG.md](AI_CORRECTION_LOG.md). Additional regressions cover V0.1 database upgrades and delayed older responses after rapid period changes.

No dedicated SAST is configured, and Semgrep/CodeQL are not installed locally. There is no formal load test, human PR review, human usability study, real-device browser result, Windows hardware result, or remote CI proof. UTC buckets do not model venue-local behavior. Sample counts do not validate accuracy, representativeness, or authenticity. Real collection is not a V0.2 deliverable.