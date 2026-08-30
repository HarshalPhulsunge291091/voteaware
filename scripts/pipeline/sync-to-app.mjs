// Copies the merged pipeline output into src/data/, which is what
// src/data/mps.ts actually imports at build time. scripts/pipeline/data/ is
// gitignored (regenerable scrape output); src/data/mps-merged.json is not —
// it's the snapshot the deployed app ships with, refreshed by re-running the
// pipeline and this sync step.
//
// Run: node scripts/pipeline/sync-to-app.mjs

import { copyFile } from "node:fs/promises";

const SRC = new URL("./data/mps-merged.json", import.meta.url);
const DEST = new URL("../../src/data/mps-merged.json", import.meta.url);

await copyFile(SRC, DEST);
console.log(`Synced ${SRC.pathname} -> ${DEST.pathname}`);
