import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = "http://localhost:5173";
const outDir = ".impeccable/review";
mkdirSync(outDir, { recursive: true });

const routes = [
  { path: "/", name: "home" },
  { path: "/mps", name: "mplist" },
  { path: "/mps/a-sharma-north-lucknow", name: "mpdetail" },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  for (const route of routes) {
    await page.goto(base + route.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${outDir}/${route.name}-${vp.name}.png`, fullPage: true });
    console.log(`shot: ${route.name}-${vp.name}.png`);
  }
  await page.close();
}
await browser.close();
