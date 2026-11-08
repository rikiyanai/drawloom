#!/usr/bin/env node
// Headless underdrawing export: portrait image(s) -> drawloom.underdrawing.v1 packet.
// Runs the real upload path of the static build in headless Chromium, then calls
// window.drawloom.exportUnderdrawing(). Photos are read locally; only the MediaPipe
// wasm/model are fetched from their CDNs, exactly as in the browser app.
//
//   npm run build
//   npm run export:underdrawing -- portrait.jpg [more.jpg] --out ./underdrawing [--width 1024]
//     [--only ovoid,doveline,notan] [--param edges.mode=1] [--param notan.levels=3] [--no-photo]
//     [--url http://localhost:3000/drawloom/]
//
// Writes <out>/<stem>/packet.json (import into Hatch Studio: Tracing guide), plus
// layers/<id>.png and pose.json for other tools.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve, normalize } from "node:path";
import { chromium } from "playwright";

const usage = "usage: export-underdrawing.mjs <image...> --out <dir> [--width N] [--only id,id] [--param id.key=value]... [--no-photo] [--url URL]";
const args = process.argv.slice(2);
const images = [];
const opts = { out: null, width: 1024, only: null, photo: true, url: null, params: {} };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--out") opts.out = args[++i];
  else if (a === "--width") opts.width = Number(args[++i]);
  else if (a === "--only") opts.only = args[++i].split(",").filter(Boolean);
  else if (a === "--param") {
    const m = /^([\w-]+)\.(\w+)=(.+)$/.exec(args[++i] ?? "");
    if (!m) { console.error(`--param expects overlay.key=value\n${usage}`); process.exit(2); }
    const value = m[3] === "true" ? true : m[3] === "false" ? false : Number(m[3]);
    if (typeof value === "number" && !Number.isFinite(value)) { console.error(`--param ${m[1]}.${m[2]}: not a number or boolean`); process.exit(2); }
    (opts.params[m[1]] ??= {})[m[2]] = value;
  }
  else if (a === "--no-photo") opts.photo = false;
  else if (a === "--url") opts.url = args[++i];
  else if (a === "-h" || a === "--help") { console.log(usage); process.exit(0); }
  else if (a.startsWith("--")) { console.error(`unknown option ${a}\n${usage}`); process.exit(2); }
  else images.push(resolve(a));
}
if (!images.length || !opts.out || !Number.isFinite(opts.width)) { console.error(usage); process.exit(2); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".txt": "text/plain", ".woff2": "font/woff2" };

async function serveExport() {
  const root = resolve("out");
  try { await stat(join(root, "index.html")); } catch { throw new Error("No static build in ./out — run `npm run build` first, or pass --url."); }
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/drawloom/, "") || "/";
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(await readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { server, url: `http://127.0.0.1:${server.address().port}/drawloom/` };
}

async function launch() {
  try { return await chromium.launch({ headless: true }); }
  catch (err) {
    // Fall back to the installed Chrome when Playwright's bundled Chromium is absent.
    try { return await chromium.launch({ headless: true, channel: "chrome" }); } catch { throw err; }
  }
}

const served = opts.url ? null : await serveExport();
const url = opts.url ?? served.url;
const browser = await launch();
let failures = 0;
try {
  for (const image of images) {
    const stem = basename(image, extname(image));
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForFunction(() => !!window.drawloom);
      await page.locator('input[type="file"]').first().setInputFiles(image);
      await page.waitForFunction(() => ["ready", "no-face", "error"].includes(window.drawloom.status()), null, { timeout: 180_000 });
      const status = await page.evaluate(() => window.drawloom.status());
      if (status === "error") throw new Error(await page.evaluate(() => window.drawloom.error()));
      const packet = await page.evaluate(
        (o) => window.drawloom.exportUnderdrawing(o),
        { sourceName: basename(image), maxWidth: opts.width, include: opts.only ?? undefined, includePhoto: opts.photo, params: opts.params }
      );
      const dir = join(resolve(opts.out), stem);
      await mkdir(join(dir, "layers"), { recursive: true });
      await writeFile(join(dir, "packet.json"), `${JSON.stringify(packet)}\n`);
      await writeFile(join(dir, "pose.json"), `${JSON.stringify({ angles: packet.angles, pose: packet.pose }, null, 2)}\n`);
      for (const layer of packet.layers) {
        await writeFile(join(dir, "layers", `${layer.id}.png`), Buffer.from(layer.png.split(",")[1], "base64"));
      }
      const a = packet.angles;
      console.log(`${basename(image)}: ${status}; ${packet.width}x${packet.height}; ${packet.layers.length} layers` +
        (a ? `; yaw ${a.yaw.toFixed(1)} pitch ${a.pitch.toFixed(1)} roll ${a.roll.toFixed(1)}` : "") +
        (packet.skipped.length ? `; skipped ${packet.skipped.map((s) => s.id).join(",")} (${packet.skipped[0].reason})` : "") +
        ` -> ${join(dir, "packet.json")}`);
    } catch (err) {
      failures++;
      console.error(`${basename(image)}: FAILED ${err instanceof Error ? err.message : err}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  served?.server.close();
}
process.exit(failures ? 1 : 0);
