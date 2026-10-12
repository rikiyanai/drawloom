import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const url = process.argv[2] ?? "http://localhost:3000/drawloom/";
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Study board", exact: true }).click();
  await page.getByText("Start a five-angle capture in webcam mode.", { exact: false }).waitFor();
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#777"; ctx.fillRect(0, 0, 640, 480);
    const shot = { dataUrl: canvas.toDataURL("image/jpeg"), yaw: 0, pitch: 0, roll: 0, capturedAt: Date.now(), pose: null };
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("drawloom-studies", 1);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put({ activeId: "test", sessions: [{ id: "test", name: "Test study", shots: { front: shot, "three-quarter-left": { ...shot, yaw: -30 } }, order: ["front", "three-quarter-left"], layout: "grid" }] }, "studies");
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Study board", exact: true }).click();
  await page.getByRole("button", { name: "Study Front", exact: true }).waitFor();
  await page.getByRole("button", { name: "Study ¾ left", exact: true }).click();
  await page.getByRole("heading", { name: "¾ left · frozen study" }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="study-board"] canvas')?.width === 640);
  await page.getByRole("button", { name: "Move ¾ left earlier", exact: true }).click();
  await page.getByRole("button", { name: "strip", exact: true }).click();
  await page.getByRole("textbox", { name: "Session name" }).fill("Renamed study");
  // Wait for the asynchronous device save to commit before reloading.
  await page.waitForFunction(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open("drawloom-studies", 1); r.onsuccess = () => resolve(r.result); });
    const saved = await new Promise(resolve => { const r = db.transaction("state").objectStore("state").get("studies"); r.onsuccess = () => resolve(r.result); }); db.close();
    return saved.sessions[0].name === "Renamed study" && saved.sessions[0].layout === "strip" && saved.sessions[0].order[0] === "three-quarter-left";
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Study board", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Session name" }).inputValue(), "Renamed study");
  assert.equal(await page.getByRole("button", { name: "strip", exact: true }).getAttribute("aria-pressed"), "true");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export contact sheet", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "drawloom-contact-sheet.png");
  assert.equal(await download.failure(), null);
  const { readFile } = await import("node:fs/promises");
  const png = await readFile(await download.path());
  assert.equal(png.readUInt32BE(16), 1352); assert.equal(png.readUInt32BE(20), 652);
  await page.getByRole("button", { name: "upload", exact: true }).click();
  await page.getByRole("button", { name: "Study board", exact: true }).click();
  await page.getByRole("button", { name: "Study Front", exact: true }).waitFor();
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up session", exact: true }).click();
  const backup = await backupPromise;
  const backupBytes = await readFile(await backup.path());
  assert.equal(JSON.parse(backupBytes.toString()).session.shots["three-quarter-left"].yaw, -30);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete session", exact: true }).click();
  await page.getByText("Start a five-angle capture in webcam mode.", { exact: false }).waitFor();
  await page.getByLabel("Study backup file").setInputFiles({ name: "study.json", mimeType: "application/json", buffer: backupBytes });
  await page.getByRole("textbox", { name: "Session name" }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Session name" }).inputValue(), "Renamed study");
  await page.getByRole("button", { name: "Study ¾ left", exact: true }).waitFor();
  await page.getByLabel("Study backup file").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"format":"drawloom-study","version":999}') });
  await page.getByRole("alert").filter({ hasText: "version 1" }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Session name" }).inputValue(), "Renamed study");
  console.log("study ok: persistence, reorder, layouts, frozen selection, PNG dimensions, mode switching, delete, backup round trip, invalid import");
} finally { await browser.close(); }
