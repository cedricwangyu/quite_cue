# V0.1 Verification Record

## Actual Execution Results

Local environment: macOS arm64, Node 22.23.4, and npm 10.9.9. Installed application versions: Next.js 16.4.5, React 19.3.1, and TypeScript 5.9.3. Exact dependencies are locked in package-lock.json.

| Command | Result |
| --- | --- |
| npm install | Installation succeeded |
| npm ci | Reproducible installation from the final lockfile succeeded; zero vulnerabilities |
| npm run db:demo | 11 public fictional records and one unpublished fixture |
| npm test | 18 passed, 0 failed |
| npm run typecheck | Passed with no TypeScript errors |
| npm run lint | Passed with no lint errors |
| npm run build | Production build succeeded |
| npx playwright install chromium | Chromium installation succeeded |
| npm run test:e2e | 18 passed: nine cases each on desktop and mobile-sized browsers |
| npm run db:audit | Zero public real records, zero real categories, and zero environment-field coverage |
| npm audit --omit=dev | 0 vulnerabilities |
| npm audit | Zero vulnerabilities after the dependency fix |
| npm run start -- --hostname 127.0.0.1 --port 3000 | Production server started successfully and was left running for local demonstration |

The production application was exercised in the integrated browser. Selecting Remote Work returned 11 results, with Atlas Shared Studio ranked first at 5/5. Its detail page displayed amenities, the Demo label, and Unknown provenance values. Returning to results preserved Remote Work. The production detail screenshot was inspected. VS Code get_errors reported no errors in src, tests, or scripts.

The desktop viewport was 1440 by 1000. Mobile dimensions came from Playwright's iPhone 13 configuration, using Chromium rather than Safari. Full-page screenshots were inspected. Tests also checked image loading, the absence of horizontal overflow, and the absence of JavaScript pageerrors in the core catalog rendering test. The temporary browser-test server used port 3100.

The SQLite ExperimentalWarning is a Node 22 notice, not a test failure. Next.js emitted LCP notices in development mode; no performance target is claimed.

## Requirements Mapping

The numbers below correspond to the 18 test requirements in the development request, not the unavailable SRS Appendix B test IDs.

| Request test | Automated evidence |
| --- | --- |
| 1 Name search | catalog.test.ts / search name |
| 2 Area search | catalog.test.ts / East Quarter |
| 3 Case-insensitive search | catalog.test.ts / WILLOW, CAFÉ |
| 4 Leading and trailing whitespace | ranking.test.ts, catalog.test.ts, browser/catalog.spec.ts |
| 5 AND filters | catalog.test.ts, browser/catalog.spec.ts |
| 6 Unknown is not True | catalog.test.ts / Copper Wi-Fi, ranking.test.ts |
| 7 Quiet Study | ranking.test.ts / 4 points |
| 8 Group Discussion | ranking.test.ts / 4 points |
| 9 Remote Work | ranking.test.ts / 5 points |
| 10 Stable ordering | ranking.test.ts / score, case-insensitive name, numeric ID |
| 11 Explanations match attributes | ranking.test.ts / verified matches, Unknown |
| 12 Empty results | catalog.test.ts, browser/catalog.spec.ts |
| 13 Missing or unpublished records | catalog.test.ts, api.test.ts, browser/catalog.spec.ts |
| 14 Invalid filters or tasks | ranking.test.ts, api.test.ts, browser/catalog.spec.ts |
| 15 Provenance validation | catalog.test.ts, import.test.ts |
| 16 90/91-day boundary | ranking.test.ts; browser rendering uses a dynamic 91-day-old fixture |
| 17 SQL Injection | catalog.test.ts, browser/catalog.spec.ts |
| 18 XSS | catalog.test.ts; a browser mock verifies that malicious names remain inert text |

Additional coverage includes 405 responses for POST, PUT, PATCH, and DELETE on both endpoints; a read-only SQLite connection rejecting DELETE; generic 503 responses on database read failures; network failures and retry; repeatable Demo seeding; import-conflict rollback with existing data preserved; duplicate-ID rejection; keyboard operation; and image loading.

## Cross-Platform Workflow Adjustments

The requested delivery mode retains the Next.js and SQLite application for installation on Windows and macOS, rather than exporting static HTML. The VS Code task uses npm by default and npm.cmd on Windows. The macOS user-directory runtime is only a platform-specific PATH fallback. The test command is now `node scripts/run-tests.mjs`, which enumerates test files and launches the current Node executable without shell wildcard expansion. The README includes PowerShell installation, execution, testing, and database environment-variable instructions.

The new launcher passed all 18 local tests. Lint, type checking, and assertions for the general and Windows task configuration also passed. The production build and all 18 browser tests passed again, and the local production service still returned HTTP 200. An Ubuntu/Windows matrix was added to CI, but it has not yet run on a Windows runner or a teammate's Windows machine.

## Unverified Items

Remote GitHub CI, real-data authenticity, second-member human review, SRS test-ID mapping, formal load testing, a five-person usability study, real iOS/Safari testing, production HTTPS, and persistent-storage deployment remain unverified. CI is configured, but no push or successful remote execution is claimed. No commit or branch was created.