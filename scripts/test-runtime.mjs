#!/usr/bin/env node
/**
 * Headless runtime test: opens drawloom, uploads a portrait, captures
 * console logs, network failures, and a screenshot of the canvas.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = process.argv[2] ?? "/tmp/portrait-test.jpg";
const URL = process.argv[3] ?? "http://localhost:3000";
const OUT_DIR = resolve(__dirname, "..", ".test-out");

import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(OUT_DIR, { recursive: true });

const logs = [];
const errors = [];
const failedRequests = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();

page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}\n${e.stack ?? ""}`));
page.on("requestfailed", (r) =>
  failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`)
);

console.log(`→ goto ${URL}`);
await page.goto(URL, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT_DIR}/01-landing.png`, fullPage: true });

console.log(`→ uploading ${TEST_IMAGE}`);
const fileInput = await page.locator('input[type="file"]');
await fileInput.setInputFiles(TEST_IMAGE);

// Wait for either canvas to render OR a status change
console.log("→ waiting for detection to complete (up to 30s)");
try {
  await page.waitForSelector("canvas", { timeout: 30000 });
  console.log("✓ canvas rendered");
} catch {
  console.log("✗ no canvas appeared in 30s");
}

// Give MediaPipe a moment to actually detect
await page.waitForTimeout(5000);

await page.screenshot({ path: `${OUT_DIR}/02-after-upload.png`, fullPage: true });

// Capture canvas image bytes directly
const canvasData = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  if (!c) return null;
  return { width: c.width, height: c.height, dataUrl: c.toDataURL("image/png") };
});

if (canvasData) {
  console.log(`✓ canvas: ${canvasData.width}x${canvasData.height}`);
  const b64 = canvasData.dataUrl.split(",")[1];
  writeFileSync(`${OUT_DIR}/03-canvas.png`, Buffer.from(b64, "base64"));
} else {
  console.log("✗ no canvas element in DOM");
}

// Try toggling all overlays on
console.log("→ toggling all overlays");
const checkboxes = await page.locator('aside input[type="checkbox"]').all();
console.log(`  found ${checkboxes.length} overlay checkboxes`);
for (const cb of checkboxes) {
  const checked = await cb.isChecked();
  if (!checked) await cb.click().catch(() => {});
}
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT_DIR}/04-all-overlays.png`, fullPage: true });

const canvasData2 = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c ? c.toDataURL("image/png") : null;
});
if (canvasData2) {
  const b64 = canvasData2.split(",")[1];
  writeFileSync(`${OUT_DIR}/05-canvas-all.png`, Buffer.from(b64, "base64"));
}

await browser.close();

console.log("\n========== RESULT ==========");
console.log(`logs:           ${logs.length}`);
console.log(`page errors:    ${errors.length}`);
console.log(`failed requests:${failedRequests.length}`);
if (errors.length) console.log("\nERRORS:\n" + errors.join("\n"));
if (failedRequests.length) console.log("\nFAILED REQ:\n" + failedRequests.join("\n"));
if (logs.length)
  console.log(
    "\nCONSOLE (last 30):\n" + logs.slice(-30).join("\n")
  );
console.log(`\nscreenshots in ${OUT_DIR}/`);
