# Quiet Cue V0.2

Quiet Cue is a task-based study and workspace discovery platform developed by Software Engineering Group 6. V0.2 is a working course demonstration using **Synthetic workspaces and Synthetic historical noise feedback only**. All current venue records and feedback are fictional. No real data collection, field investigation, source verification, or human evidence review has occurred; generated records must not be presented as such.

## Technology Stack

- Next.js App Router + React + TypeScript
- Next.js Node.js Route Handlers
- SQLite accessed through Node's built-in `node:sqlite`, without an external database service
- Custom responsive CSS and Lucide icons
- Node Test Runner with TypeScript tests, Playwright, and ESLint

## Features Implemented

- A public catalog covering five workspace categories, with no login required.
- Name and area search with trimmed whitespace, Unicode lowercase comparison, and a limit of 100 UTF-16 code units.
- AND-combined filters for category, noise, Wi-Fi, power outlets, group suitability, and cost.
- Deterministic scoring and explanations for Quiet Study, Group Discussion, and Remote Work.
- Ordering by descending score, case-insensitive name, then ascending numeric ID. Without a task, results are ordered by name.
- Workspace details, provenance, Unknown values, and warnings for records older than 90 UTC calendar days.
- URL-persisted filters and search restoration when returning from details, plus loading, empty, error, and retry states.
- Parameterized SQL, safe React text rendering, strict enum validation, and read-only APIs.
- Separate Synthetic seeding, transactional workspace/feedback imports, provenance field validation, and dataset audits. Real-data import support is retained for a future workflow, not evidence of current collection.
- Historical noise estimates on workspace details, with Weekday/Weekend and Morning/Afternoon/Evening controls, sample counts, count-based confidence, timestamps, loading/error/retry states, and a computed three-period overview.
- A 90-day history window, approved-only feedback, Synthetic/real source isolation, and an explicit Insufficient Data state. Historical estimates do not change existing task scores or rankings.

See [docs/NOISE_ESTIMATION.md](docs/NOISE_ESTIMATION.md) for calculation rules, the API contract, data constraints, and Synthetic lifecycle commands.

## Prerequisites

Install Node.js **22.18.0 or later** and npm. Node 22 LTS is recommended. Node 22 may print an SQLite ExperimentalWarning; this does not indicate a test failure. Local verification used Node 22.23.4.

**The project is designed to run on Windows, macOS, and Linux. It does not require macOS, WSL, Python, or a separate SQLite installation.** Each teammate should install Node.js locally and use the same repository and commands. Do not copy `node_modules` or `.next` from another operating system.

On the macOS arm64 machine used for development, a separate Node runtime was installed in the user's directory without changing system configuration. If npm is unavailable in a new terminal on that machine, run:

```sh
export PATH="$HOME/.local/share/quiet-cue/node-v22.23.4-darwin-arm64/bin:$PATH"
```

This path applies only to the development machine. Other machines should use their own Node installation.

### Windows PowerShell

Install Node.js 22 LTS (at least 22.18.0) and Git, then restart VS Code. Open the repository folder and a PowerShell terminal in VS Code, and run:

```powershell
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run db:demo
npm.cmd run dev
```

Open http://localhost:3000 in a browser. `npm.cmd` provides the same npm commands while avoiding PowerShell execution-policy restrictions on npm.ps1. No change to the system execution policy is required.

For production mode, stop the development server with Ctrl+C, then run:

```powershell
npm.cmd run build
npm.cmd run start
```

Run tests and checks:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

The test launcher enumerates test files through Node rather than relying on Bash wildcard expansion. The VS Code `Quiet Cue: Run V0.1` task uses `npm.cmd` on Windows and `npm` elsewhere. Initialize the database and complete a build before running that task. Its user-directory Node PATH fallback applies only to macOS and is not a Windows requirement.

## Installation & Database Initialization

Run these commands from the repository root:

```sh
npm ci
npm run db:demo
npm run dev
```

Open http://localhost:3000. To use another port:

```sh
npm run dev -- --port 3001
```

The default database is generated at `data/quiet-cue.sqlite` and is excluded from Git. Demo seeding transactionally replaces workspaces with `is_demo = 1` and their Synthetic feedback. It does not delete real records. ID conflicts or restricted foreign-key dependencies roll back the entire transaction.

The default Demo dataset contains **12 Synthetic workspaces (11 public, one unpublished) and 366 Synthetic feedback records**. Each workspace has one pending and one rejected fixture, both excluded from estimates. Cloudberry (ID 10) has two approved samples per day-type/period bucket and intentionally shows Insufficient Data. Verification dates, real source URLs, and field-observation references are NULL. Photographs are illustrative, not actual photographs of the fictional venues.

```sh
npm run db:demo -- --seed 2101 --now 2026-11-16T12:00:00.000Z
```

Both flags are optional: seed defaults to `2101`, and the reference time defaults to the current time. Reproduction requires the same seed, reference date/time, and ordered workspace list. The PRNG uses 32-bit state; a seed alone does not freeze dates. Approved fixtures span roughly the preceding month. Fixed-date fixtures eventually age out of the 90-day window: rerun without `--now` for a current demonstration.

Use the server-side environment variable `QUIET_CUE_DB_PATH` to select another database. Initialization, import, and server processes must use the same path. The variable has no `NEXT_PUBLIC_` prefix and is not sent to the browser. If the database has not been initialized or cannot be read, the UI displays `Results temporarily unavailable.`.

The default path follows the current operating system's path conventions, so an environment variable is usually unnecessary. To use another path, set it in the same terminal before initializing and starting the application:

```powershell
# Windows PowerShell
$env:QUIET_CUE_DB_PATH = Join-Path $PWD "data\team.sqlite"
npm.cmd run db:demo
npm.cmd run dev
```

```sh
# macOS / Linux
export QUIET_CUE_DB_PATH="$PWD/data/team.sqlite"
npm run db:demo
npm run dev
```

This is a cross-platform application workflow, **not a static HTML export**. The output of `npm run build` still requires a Node server. Do not double-click HTML files or distribute `.next` to teammates; each teammate should install and build from the repository. Database paths should refer to each machine's own filesystem.

## Production Run

```sh
npm run build
npm run start
```

SQLite must be stored on persistent storage readable by the Node server. The application does not support Edge Runtime and should not be deployed unchanged to a serverless environment without persistent storage. Verification has focused on local demonstration; no paid service has been deployed.

## How to Test

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Browser tests automatically start a temporary development server on port **3100** and stop it afterward. Ensure that port is available and run `npm run db:demo` first. Tests cover desktop Chromium and mobile-sized Chromium, not real iOS Safari. Screenshots and failure traces are written to `test-results/`, which is excluded from Git.

The GitHub Actions configuration in `.github/workflows/ci.yml` runs the same checks on Ubuntu and Windows runners. Local macOS checks have been executed. Windows hardware and remote CI results must be verified after the team runs the application or pushes the repository; the configuration alone is not evidence of a pass.

V0.2 verification so far includes 44 passing Node tests and eight passing focused noise browser checks across desktop/mobile-sized Chromium. Full end-to-end verification is tracked separately in [docs/VERIFICATION.md](docs/VERIFICATION.md); no full-suite pass or total is asserted here while that verification is in progress.

## Internal Data Commands

All commands below are team-only CLI operations, not public submission endpoints. Use `npm.cmd` instead of `npm` in Windows PowerShell.

```sh
npm run db:import -- --synthetic data/synthetic-workspaces.template.json
npm run db:feedback:import -- data/noise-feedback.template.json
npm run db:synthetic -- --seed 2101
npm run db:synthetic -- --clear
npm run db:audit
```

The workspace template explicitly sets `is_demo: 1`; the feedback template explicitly sets `is_synthetic: 1` and `source_type: "synthetic"`. Import workspace 301 before its example feedback. The feedback template's fixed January timestamp illustrates the format and may be outside the history window; it is not fresh evidence. Feedback imports insert only, so repeating the same file fails on duplicate IDs or natural keys. Workspace imports atomically upsert matching-marker IDs without deleting referenced workspaces; duplicate batch IDs and opposite-marker conflicts reject the batch.

`db:synthetic` regenerates Synthetic feedback only for the existing `is_demo = 1` workspace list; it does not recreate workspaces or change their fields. It replaces Synthetic feedback, including imported Synthetic feedback. Optional `--seed` and `--now` have the same meaning as in `db:demo`. `--clear` removes Synthetic feedback and Synthetic workspaces; real records are not deleted. Foreign-key `RESTRICT` prevents deletion when a retained feedback dependency exists and rolls back the operation.

The legacy workspace marker `is_demo` is preserved and means Synthetic in V0.2. Feedback uses explicit `is_synthetic` and `source_type` fields. Imports enforce matching workspace/feedback markers, canonical UTC timestamps, and atomic rollback. Approved real feedback would additionally require `source_reference` and human evidence review; a reference passing validation does not establish authenticity.

### Future Real-Data Format Only

[data/real-records.template.json](data/real-records.template.json) remains an unpublished format example, not an actual collected record. A future, separately authorized workflow can use `npm run db:import -- path/to/team-records.json` with `is_demo: 0`. All schema fields and unique positive safe-integer IDs are required. Use `1`, `0`, or `null` for amenities; Unknown must not become False. Published real records require description, collection method, source note, and a non-future verification date. Field Observation requires `observation_ref`, Online Source requires an HTTP(S) URL without credentials, and Both requires both. Human evidence review must precede publication; none is claimed for this release.

The audit excludes Synthetic workspaces and reports public real records, categories, and known-value coverage across five environment fields. This diagnostic is not V0.2 Synthetic-demo acceptance or authenticity evidence. The exact SRS definition of the 80% threshold has not been supplied.

## API

```text
GET /api/workspaces?search=Willow&category=Library&noise=Quiet&wifi=true&task=Quiet%20Study
GET /api/workspaces/1
GET /api/workspaces/1/noise-estimate?dayType=Weekday&timePeriod=Morning
```

Supported parameters are `search`, `category`, `noise`, `wifi`, `outlets`, `group`, `cost`, and `task`. Omit unused optional parameters; amenity filters accept only `true`. Invalid, duplicate, or unknown parameters return 400. Missing or unpublished records return 404, database read failures return 503, and POST, PUT, PATCH, and DELETE return 405.

The noise endpoint accepts **only** `dayType` (`Weekday` or `Weekend`) and `timePeriod` (`Morning`, `Afternoon`, or `Evening`), defaulting to `Weekday` and `Morning` when omitted. It returns `{ estimate, overview, notices }` with `Cache-Control: no-store`; `overview` contains all three periods for the selected day type. Invalid IDs/enums, duplicate keys, and unknown keys return 400; missing/unpublished workspaces return 404; database failures return a generic 503 without paths, SQL, or feedback rows. The endpoint and estimation service are strictly read-only. There is no public feedback submission API.

## Project Structure

```text
src/app/                 Pages, layouts, read-only API routes
src/components/          Catalog, workspace cards, historical noise, retry controls
src/lib/                 Shared types, validation, ranking, freshness, UTC buckets
src/server/              SQLite, catalog, noise estimation, validation, Synthetic data
scripts/                 Synthetic seed/lifecycle, workspace/feedback import, audit
data/                    Synthetic templates and future real-record format template
public/images/           Local illustrative category photos
tests/                   Unit, database, API and import tests
tests/browser/           Desktop/mobile workflows
docs/                    Architecture, noise estimation, verification, AI corrections
.github/workflows/       CI configuration
```

## Known Limitations

- All current workspace and feedback data are Synthetic. Real-world dataset size and coverage targets, including the earlier 20-record target, are future considerations, not V0.2 acceptance gaps or a request to collect data.
- The repository SPMP was reviewed, but SRS v2.0 and the original ADR-001 were not supplied. Scoring follows the development request; the implementation architecture notes do not replace or formally approve the original ADR.
- Formal load testing, a five-person usability study, human PR review, real-device Safari testing, and remote deployment have not been performed.
- No dedicated SAST workflow is configured; Semgrep and CodeQL are not installed locally. ESLint and dependency auditing are not substitutes for SAST. No Windows hardware or remote CI pass is claimed.
- Historical estimates use exact UTC buckets and a simple ordinal mean, not live monitoring or ML. Confidence labels describe sample counts, not measured predictive accuracy; fixed fixtures age out.
- Full-catalog loading and synchronous SQLite suit a small course demonstration. Pagination is not implemented, and no performance target is claimed.
- Google Fonts is an optional external request. Offline use falls back to installed fonts; core data and images are local.
- All venue images illustrate categories. They do not represent actual venue photographs, including for future imported records.

## Future Improvements

Complete SRS test-ID mapping, obtain actual human review and usability/load evidence, and validate a persistent SQLite deployment and cross-platform execution. Real-data collection and moderated public feedback are future, separately authorized work, not part of V0.2. Accounts, maps, live monitoring, reservations, and generative-AI recommendations remain out of scope.

## Visual Assets

Illustrative photographs are from Unsplash. Their URLs and intended use are documented in [public/images/SOURCES.md](public/images/SOURCES.md). No photograph is treated as field-observation evidence.