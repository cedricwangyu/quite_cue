import { test, expect } from "@playwright/test";
import { demoData } from "../../src/server/demo-data";

test("public catalog renders photos and fits the viewport", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".workspace-card")).toHaveCount(11);
  await expect(page.getByText("Demo Data", { exact: true })).toBeVisible();
  for (const image of await page.locator(".card-image img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("catalog.png"), fullPage: true });
});

test("search and AND filters survive task change and detail return", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("  WILLOW  ");
  await page.getByLabel("Workspace category", { exact: true }).selectOption("Library");
  await page.getByLabel("Noise level", { exact: true }).selectOption("Quiet");
  await page.getByLabel("Wi-Fi Available", { exact: true }).check();
  await page.getByRole("button", { name: "Quiet Study", exact: true }).click();
  await expect(page.locator(".workspace-card")).toHaveCount(1);
  await expect(page.locator(".recommendation strong")).toHaveText("4 / 4");
  await page.getByRole("link", { name: "View Willow Reading Library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Willow Reading Library" })).toBeVisible();
  await expect(page.getByText("Fictional Demo Data.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to results" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("  WILLOW  ");
  await expect(page.getByLabel("Wi-Fi Available", { exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Quiet Study", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".workspace-card")).toHaveCount(1);
});

test("all three tasks update deterministic ranking", async ({ page }) => {
  await page.goto("/");
  for (const [task, first] of [["Quiet Study", "Northlight Workrooms"], ["Group Discussion", "Atlas Shared Studio"], ["Remote Work", "Atlas Shared Studio"]]) {
    await page.getByRole("button", { name: task, exact: true }).click();
    await expect(page.locator(".results-heading p")).toContainText(`Ranked for ${task}`);
    await expect(page.locator(".workspace-card h3").first()).toHaveText(first);
    await expect(page.locator(".recommendation")).toHaveCount(11);
  }
});

test("empty search, injection strings and clear all are handled", async ({ page }) => {
  await page.goto("/");
  for (const text of ["NoSuchVenue", "' OR 1=1 --", "<script>alert(1)</script>"]) {
    await page.getByRole("searchbox").fill(text);
    await expect(page.getByRole("heading", { name: "No workspaces match your search." })).toBeVisible();
  }
  await page.getByRole("button", { name: "Clear All Filters", exact: true }).last().click();
  await expect(page.locator(".workspace-card")).toHaveCount(11);
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.getByRole("searchbox")).toHaveAttribute("maxlength", "100");
});

test("Unknown detail attributes and unpublished not found", async ({ page }) => {
  await page.goto("/workspaces/10");
  await expect(page.getByRole("heading", { name: "Cloudberry Lounge" })).toBeVisible();
  await expect(page.locator(".detail-amenities dd").filter({ hasText: "Unknown" })).toHaveCount(6);
  const result = await page.goto("/workspaces/12");
  expect(result?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Workspace not found." })).toBeVisible();
});

test("API error and network failure can be retried", async ({ page }) => {
  let failing = true;
  await page.route("**/api/workspaces*", route => failing ? route.fulfill({ status: 503, json: { error: "sensitive SQL error" } }) : route.continue());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Results temporarily unavailable." })).toBeVisible();
  await expect(page.getByText("sensitive SQL error")).toHaveCount(0);
  failing = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".workspace-card")).toHaveCount(11);
  await page.unroute("**/api/workspaces*");
  await page.route("**/api/workspaces*", route => route.abort());
  await page.getByRole("searchbox").fill("Willow");
  await expect(page.getByRole("heading", { name: "Results temporarily unavailable." })).toBeVisible();
});

test("unsafe record text is inert, stale labels and zero scores render", async ({ page }) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 91);
  const unsafeName = '<img src=x onerror="window.xssExecuted=true">';
  const fixture = { ...demoData[9], name: unsafeName, is_demo: 0, last_verified_date: date.toISOString().slice(0,10), score: 0, max_score: 4, explanation: "No verified task match." };
  await page.route("**/api/workspaces*", route => route.fulfill({ json: { workspaces: [fixture], task: "Quiet Study" } }));
  await page.goto("/?task=Quiet+Study");
  await expect(page.locator(".workspace-card h3")).toHaveText(unsafeName);
  await expect(page.getByText("May be outdated.", { exact: true })).toBeVisible();
  await expect(page.getByText("No verified task match.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => "xssExecuted" in window)).toBe(false);
  await expect(page.locator(".card-body img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("keyboard can operate search and task buttons", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").focus();
  await page.keyboard.type("Willow");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Quiet Study", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".workspace-card")).toHaveCount(1);
});

test("HTTP API validation, hidden records and all write verbs", async ({ request }) => {
  for (const query of ["task=AI", "noise=Silent", "category=Park", "cost=Cheap", "wifi=false", `search=${"a".repeat(101)}`]) expect((await request.get(`/api/workspaces?${query}`)).status()).toBe(400);
  for (const path of ["/api/workspaces", "/api/workspaces/1"]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect((await request.fetch(path, { method })).status()).toBe(405);
  }
  for (const id of [12, 999]) expect((await request.get(`/api/workspaces/${id}`)).status()).toBe(404);
  expect((await request.get("/api/workspaces/1")).status()).toBe(200);
});