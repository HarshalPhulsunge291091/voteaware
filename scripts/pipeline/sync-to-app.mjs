// Copies pipeline output into src/data/, which is what src/data/mps.ts and
// MPDetail.tsx actually import at build time. scripts/pipeline/data/ is
// gitignored (regenerable scrape output); the src/data/ copies are not —
// they're the snapshot the deployed app ships with, refreshed by re-running
// the pipeline and this sync step.
//
// Run: node scripts/pipeline/sync-to-app.mjs

import { copyFile } from "node:fs/promises";

const FILES = ["mps-merged.json", "mp-candidates.json"];

for (const name of FILES) {
  const src = new URL(`./data/${name}`, import.meta.url);
  const dest = new URL(`../../src/data/${name}`, import.meta.url);
  await copyFile(src, dest);
  console.log(`Synced ${src.pathname} -> ${dest.pathname}`);
}
