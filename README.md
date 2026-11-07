# Quiet Cue V0.1

Quiet Cue is a task-based study and workspace discovery platform developed by Software Engineering Group 6. V0.1 is a working course demonstration, not a claim that the verified real-world dataset has passed final acceptance.

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
- Separate Demo seeding, transactional real-data imports, provenance validation, and dataset audits.

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

The default database is generated at `data/quiet-cue.sqlite` and is excluded from Git. Demo seeding is repeatable and replaces only records with `is_demo = 1`. It does not delete real records. ID conflicts roll back the entire transaction.

The Demo dataset contains **11 public fictional workspaces and one unpublished test record**. Verification dates, real source URLs, and field-observation references are NULL. Photographs are illustrative, not actual photographs of the fictional venues.

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

## Real Data Import

Use `data/real-records.template.json` as the import template. It is an unpublished draft, not a verified real-world record.

1. Collect real venue information through team field visits, public websites, and manual verification.
2. Supply a JSON array containing every template field and unique positive integer IDs. Demo IDs are 1-12; starting real records at 101 is recommended.
3. Use `1`, `0`, or `null` for `wifi`, `outlets`, and `group_friendly`. Use `null` for unknown noise, cost, dates, and other nullable fields. Do not replace Unknown with False.
4. Set `is_demo` to `0`. Before publication, provide the name, category, area, address, description, collection method, source note, and actual verification date.
5. Field Observation requires an observation reference. Online Source requires an HTTP(S) source URL. Both requires both references. Future dates, invalid enums, missing fields, and unsafe URLs are rejected.
6. Have a second team member review the evidence before setting `published: 1` and importing through the CLI.

```sh
npm run db:import -- path/to/team-records.json
npm run db:audit
```

The CLI validates the entire input before starting a transaction. Duplicate IDs or conflicts with Demo IDs reject the import. Importing an existing real ID updates that real record. **This operation is for local team use only; there is no public write API.**

The audit excludes Demo data and reports the number of public real records, category count, and known-value coverage across five environment fields. The exact SRS definition of the 80% threshold has not been supplied, so this coverage is a diagnostic metric, not formal acceptance evidence. Field validation cannot establish evidence authenticity automatically.

## API

```text
GET /api/workspaces?search=Willow&category=Library&noise=Quiet&wifi=true&task=Quiet%20Study
GET /api/workspaces/1
```

Supported parameters are `search`, `category`, `noise`, `wifi`, `outlets`, `group`, `cost`, and `task`. Omit unused optional parameters; amenity filters accept only `true`. Invalid, duplicate, or unknown parameters return 400. Missing or unpublished records return 404, database read failures return 503, and POST, PUT, PATCH, and DELETE return 405.

## Project Structure

```text
src/app/                 Pages, layouts, read-only API routes
src/components/          Catalog controls, workspace cards, retry control
src/lib/                 Shared types, input validation, ranking, freshness
src/server/              SQLite schema/access, search, provenance validation, Demo
scripts/                 Demo seed, real import, audit
data/                    Unpublished real-record JSON template
public/images/           Local illustrative category photos
tests/                   Unit, database, API and import tests
tests/browser/           Desktop/mobile workflows
docs/                    Architecture, verification and AI correction record
.github/workflows/       CI configuration
```

## Known Limitations

- There are currently **zero** verified public real-world records. The formal target of 20 records across at least three categories has not been reached.
- The repository SPMP was reviewed, but SRS v2.0 and the original ADR-001 were not supplied. Scoring follows the development request; the implementation architecture notes do not replace or formally approve the original ADR.
- Formal load testing, a five-person usability study, human PR review, real-device Safari testing, and remote deployment have not been performed.
- Full-catalog loading and synchronous SQLite suit a small course demonstration. Pagination is not implemented, and no performance target is claimed.
- Google Fonts is an optional external request. Offline use falls back to installed fonts; core data and images are local.
- All venue images illustrate categories. They do not represent actual venue photographs, including for future imported records.

## Future Improvements

Prioritize collecting and reviewing real records, completing SRS test-ID mapping, obtaining human review and usability/load evidence, and validating a persistent SQLite deployment. Moderated user feedback belongs to a later release. Accounts, maps, live monitoring, reservations, and generative-AI recommendations are outside V0.1 scope.

## Visual Assets

Illustrative photographs are from Unsplash. Their URLs and intended use are documented in `public/images/SOURCES.md`. No photograph is treated as field-observation evidence.