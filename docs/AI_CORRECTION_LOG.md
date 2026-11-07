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