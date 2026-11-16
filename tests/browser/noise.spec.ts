import { test, expect } from "@playwright/test";

test("historical estimates match API statistics and respond to period controls", async ({ page, request }, testInfo) => {
  await page.goto("/workspaces/1?from=search%3DWillow%26task%3DQuiet%2BStudy");
  const history = page.getByRole("region", { name: "Historical Noise Estimation" });
  await expect(history.getByText("Synthetic Data", { exact: true })).toBeVisible();
  await expect(history.getByText("Based on synthetic demonstration data.", { exact: false })).toBeVisible();
  for (const [dayType, timePeriod] of [["Weekday", "Morning"], ["Weekday", "Afternoon"], ["Weekend", "Evening"]]) {
    await page.getByLabel("Day type (UTC)").selectOption(dayType);
    await page.getByLabel("Time period (UTC)").selectOption(timePeriod);
    const response = await request.get(`/api/workspaces/1/noise-estimate?dayType=${dayType}&timePeriod=${timePeriod}`);
    const { estimate, overview } = await response.json();
    await expect(history.locator(".noise-level")).toHaveText(estimate.estimatedNoiseLevel);
    await expect(history.getByTestId("noise-sample-count")).toHaveText(String(estimate.sampleCount));
    await expect(history.getByText(`${dayType} / ${timePeriod} (UTC)`, { exact: true })).toBeVisible();
    await expect(history.locator(".noise-summary")).toContainText(estimate.confidenceLabel);
    for (const period of overview) {
      const item = history.locator(".noise-overview li").filter({ has: page.getByText(period.timePeriod, { exact: true }) });
      await expect(item.locator("strong")).toHaveText(period.estimatedNoiseLevel ?? "Insufficient Data");
      await expect(item.locator("meter")).toHaveAttribute("aria-valuetext", `${period.average.toFixed(2)} out of 3`);
    }
  }
  await history.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("noise-detail.png"), fullPage: true });
  await page.getByRole("link", { name: "Back to results" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("Willow");
  await expect(page.getByRole("button", { name: "Quiet Study", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".workspace-card")).toHaveCount(1);
});

test("insufficient samples never fabricate a period estimate", async ({ page }) => {
  await page.goto("/workspaces/10");
  const history = page.getByRole("region", { name: "Historical Noise Estimation" });
  await expect(history.locator(".noise-level")).toHaveText("Insufficient Data");
  await expect(history.getByTestId("noise-sample-count")).toHaveText("2");
  await expect(history.getByText("Not enough historical feedback to estimate noise for this period.")).toBeVisible();
  await page.getByLabel("Day type (UTC)").selectOption("Weekend");
  await page.getByLabel("Time period (UTC)").selectOption("Evening");
  await expect(history.getByText("Weekend / Evening (UTC)", { exact: true })).toBeVisible();
  await expect(history.locator(".noise-level")).toHaveText("Insufficient Data");
  await expect(history.locator("meter.no-samples")).toHaveCount(3);
});

test("historical loading and sanitized error states support retry", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route("**/noise-estimate?**", async route => {
    if (fail) {
      await gate;
      await route.fulfill({ status: 503, json: { error: "private database path must not render" } });
    } else await route.continue();
  });
  await page.goto("/workspaces/1");
  const history = page.getByRole("region", { name: "Historical Noise Estimation" });
  await expect(history.getByRole("status")).toHaveText("Loading historical noise estimate...");
  release();
  await expect(history.getByRole("alert")).toContainText("Historical noise estimates temporarily unavailable.");
  await expect(page.getByText("private database path must not render")).toHaveCount(0);
  fail = false;
  await history.getByRole("button", { name: "Retry" }).click();
  await expect(history.locator(".noise-level")).toBeVisible();
});

test("rapid period changes cannot let an older response replace the current estimate", async ({ page, request }) => {
  const delayed = await (await request.get("/api/workspaces/1/noise-estimate?dayType=Weekday&timePeriod=Afternoon")).json();
  let release!: () => void;
  let captured!: () => void;
  let finished!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { captured = resolve; });
  const completed = new Promise<void>(resolve => { finished = resolve; });
  await page.route("**/noise-estimate?**", async route => {
    if (new URL(route.request().url()).searchParams.get("timePeriod") === "Afternoon") {
      captured();
      await gate;
      try { await route.fulfill({ json: delayed }); } finally { finished(); }
    } else await route.continue();
  });
  await page.goto("/workspaces/1");
  const history = page.getByRole("region", { name: "Historical Noise Estimation" });
  await expect(history.locator(".noise-level")).toBeVisible();
  await page.getByLabel("Time period (UTC)").selectOption("Afternoon");
  await requested;
  await page.getByLabel("Time period (UTC)").selectOption("Evening");
  await expect(history.getByText("Weekday / Evening (UTC)", { exact: true })).toBeVisible();
  release();
  await completed;
  await expect(history.getByText("Weekday / Evening (UTC)", { exact: true })).toBeVisible();
  await expect(history.locator(".noise-overview li[aria-current]")).toContainText("Evening");
});

test("noise endpoint rejects writes and unsafe input over HTTP", async ({ request }) => {
  const endpoint = "/api/workspaces/1/noise-estimate";
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect((await request.fetch(endpoint, { method })).status()).toBe(405);
  for (const query of ["dayType=Weekend&dayType=Weekday", "dayType=", "other=1", "timePeriod=%3Cscript%3E", "dayType=Weekday%27%20OR%201%3D1"]) {
    expect((await request.get(`${endpoint}?${query}`)).status()).toBe(400);
  }
  for (const id of ["0", "-1", "1.5", "1%20OR%201%3D1"]) expect((await request.get(`/api/workspaces/${id}/noise-estimate`)).status()).toBe(400);
  for (const id of [12, 99999]) expect((await request.get(`/api/workspaces/${id}/noise-estimate`)).status()).toBe(404);
});