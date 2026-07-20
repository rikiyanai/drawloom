#!/usr/bin/env node
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/drawloom/";
const expectedOverlays = [
  "Ovoid silhouette",
  "Face centerline trace",
  "Face mesh wireframe",
  "Eye-line + plumb + grid",
  "Notan (value reduction)",
  "Edge / squint / silhouette",
];
const removedClaims = [
  "Loomis head",
  "Reilly rhythms",
  "Feature lines (sight-size guides)",
  "Proportion compare",
  "Skeleton underlay (skull)",
  "skull overlay",
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });

  const activeSplit = page.getByRole("button", { name: "split + skull" });
  if (!(await activeSplit.getAttribute("class"))?.includes("bg-cyan-600")) {
    throw new Error("split + skull is not the default layout");
  }
  if ((await page.getByRole("button", { name: "skull overlay" }).count()) !== 0) {
    throw new Error("skull superimposition is still exposed");
  }

  await page.getByRole("button", { name: "webcam (live)" }).click();
  const visibleOverlays = await page.locator("aside .font-medium").allTextContents();
  if (JSON.stringify(visibleOverlays) !== JSON.stringify(expectedOverlays)) {
    throw new Error(`unexpected overlay surface: ${JSON.stringify(visibleOverlays)}`);
  }

  const body = await page.locator("body").innerText();
  for (const claim of removedClaims) {
    if (body.includes(claim)) throw new Error(`removed claim is still visible: ${claim}`);
  }

  console.log(`surface ok: split default; ${visibleOverlays.length} audited overlays`);
} finally {
  await browser.close();
}
