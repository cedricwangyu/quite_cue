import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = resolve(root, "submissions/QuietCue_Implementation_Increment_Review.html");
const output = resolve(root, "submissions/QuietCue_Implementation_Increment_Review.pdf");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(source).href);
  await page.emulateMedia({ media: "print" });
  const overflow = await page.locator(".sheet").evaluateAll(sheets => sheets.some(sheet => {
    const footer = sheet.querySelector(".footer");
    const lastContent = footer.previousElementSibling;
    return sheet.getBoundingClientRect().height > 1123 || lastContent.getBoundingClientRect().bottom > footer.getBoundingClientRect().top;
  }));
  if (overflow) throw new Error("Report content exceeds an A4 page; adjust the layout before generating the PDF.");
  await page.pdf({ path: output, format: "A4", printBackground: true, preferCSSPageSize: true });
  console.log(`Generated ${output}`);
} finally {
  await browser.close();
}