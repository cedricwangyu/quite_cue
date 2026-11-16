# AI Correction Log

## 1. Unicode Search Mismatch

- Initial implementation: SQLite LIKE with NOCASE and parameter binding.
- Problem: SQLite's default NOCASE comparison covers only ASCII; `CAFÉ` did not match either of the two Cafe names containing an accented character.
- Detection: A regression assertion for `search=CAFÉ` returned zero records instead of two.
- Correction: Register a deterministic casefold function in SQLite and use JavaScript lowercase conversion consistently for names, areas, and keywords. Preserve parameter binding and LIKE escaping.
- Verification: All seven tests in the same database test file passed after the fix, followed by the full test suite.

## 2. Accessible Filter Names

- Initial implementation: Each label contained its select element and all options.
- Problem: An exact accessible-name match for `Workspace category` failed, causing the combined-filter browser test to time out.
- Detection: Playwright's exact getByLabel lookup could not locate the control.
- Correction: Explicitly associate each label's htmlFor with the select's id for category, noise, and cost.
- Verification: Combined filters, task changes, and navigation back from details passed on desktop and mobile-sized browsers.

## 3. Not Found HTTP Status

- Initial implementation: Add a global loading.tsx boundary and call notFound from the detail page.
- Problem: The loading Suspense boundary streamed HTTP 200 before rendering Not Found, so the response status was not 404.
- Detection: Playwright expected 404 for an unpublished detail page but received 200.
- Correction: Remove the global loading boundary while retaining the catalog's own asynchronous loading feedback.
- Verification: Unpublished detail pages returned actual 404 responses on desktop and mobile-sized browsers. API requests for missing and unpublished IDs also returned 404.

## 4. Image Test Wait Conditions

- Initial implementation: Check every image's naturalWidth immediately after cards appeared.
- Problem: Offscreen images were lazy-loaded and had not entered the viewport, producing a false failure.
- Detection: The browser image-loading assertion failed.
- Correction: Scroll each image into view, use expect.poll to wait for complete and naturalWidth, then inspect the full-page screenshot. Keep the image assertions.
- Verification: All 11 card images passed on desktop and mobile-sized browsers. The first row additionally uses eager loading; remaining images stay lazy-loaded.

## 5. Development Dependency Security Alert

- Initial installation: minimatch, a transitive TypeScript ESLint dependency of eslint-config-next, caused eight moderate audit findings.
- Detection: npm install and npm audit reported the findings; the production-only dependency audit reported zero.
- Correction: Verify the available package version and apply a scoped minimatch override of ^11.0.5 under @typescript-eslint/typescript-estree. Do not use audit fix --force, which would downgrade the configuration.
- Verification: Repeat npm install, lint, and the full npm audit. The audit reported zero vulnerabilities, and the final type check, build, and browser tests passed.

## Environment Notes

Node, npm, and ripgrep were initially unavailable on PATH. An official Node 22 arm64 tarball was used, and its SHA-256 matched the official checksum. The SPMP was extracted read-only using macOS PDFKit. The workspace initialization tool did not recognize the VS Code workspace, so the project was created manually at the confirmed repository path. npm reformatted package.json after installation, causing one patch-context mismatch. Reading the current file and retrying resolved it without overwriting the SPMP.

This log records only observed issues. It does not invent human-review outcomes or formal performance and usability results.

## V0.2 Additions - 2026-11-16

Entries 1-5 and the environment notes above preserve the earlier V0.1 history. The following entries record observed AI implementation corrections, not human review. No human PR review or real-data evidence review occurred. All current workspace and feedback records are Synthetic; there was no real collection or investigation.

### 6. Workspace Updates With Feedback Foreign Keys

- Initial implementation: Workspace import used DELETE followed by INSERT to replace an existing ID.
- Problem: Adding `noise_feedback.workspace_id` with `ON DELETE RESTRICT` made replacement deletion invalid for a workspace with feedback and would break dependency-preserving updates.
- Correction: Use `INSERT ... ON CONFLICT(id) DO UPDATE` for same-marker workspace imports, preserving the workspace ID, existing Synthetic marker, and feedback references. Reject opposite-marker conflicts and retain atomic rollback.
- Verification: The import regression checks cover updating a workspace with dependent feedback; the V0.2 Node suite passed all 44 tests. This is code/test evidence, not human approval or provenance authentication.

### 7. Repeated Noise Selection Left Loading Active

- Initial implementation: A day-type/period select handler set Loading even when the selected value had not changed.
- Problem: The unchanged state did not rerun the effect, leaving Loading active without a new request.
- Detection: The new focused browser run finished with seven passes and one mobile failure.
- Correction: Guard both handlers so Loading and selection state change only when the selected value differs from the current value.
- Verification: Rerunning the focused historical-noise browser checks passed all eight desktop/mobile-sized Chromium checks. This is not a claim that the separate full end-to-end suite has finished, nor real-device usability evidence.

### 8. Local Type Declarations and Generated Cache Blocked Typecheck

- Observed problem: Local duplicate `@types` entries matching `* 2` and a duplicate generated `.next` cache blocked type checking; these were local dependency/generated-output issues, not application type errors to suppress.
- Correction: Restore dependencies with `npm ci`, remove generated `.next` output, and regenerate Next.js types with `next typegen` before rerunning checks. Do not weaken compiler settings or commit generated caches as a workaround.
- Verification: Type generation and the subsequent checks passed after cleanup. This does not establish Windows or remote CI execution.

### V0.2 Evidence Boundary

The confirmed slice comprises 44 passing Node tests and eight passing focused noise browser checks. Full browser-suite verification is handled separately in [VERIFICATION.md](VERIFICATION.md), without a full-suite result asserted here. No dedicated SAST workflow is configured and Semgrep/CodeQL are not installed locally. No formal load test, human PR review, human usability study, real-device browser test, or Windows/remote CI proof is claimed. Field validation and Synthetic approval fixtures are not real-source authenticity evidence.