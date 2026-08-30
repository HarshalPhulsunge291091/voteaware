// Source: DataMeet's Lok Sabha parliamentary constituency boundaries
// (2019 delimitation — unchanged for the 2024 election, except a few
// documented renames/mergers; see build-geo.mjs for those caveats).
//
// DataMeet is a well-known Indian open-geodata community project. This
// specific file ("simplified", <2MB, web-optimized) is CC0 1.0 Universal
// (public domain), created by Arun Ganesh with corrected/crowdsourced
// attributes — see the dataset README:
// https://github.com/datameet/maps/blob/master/parliamentary-constituencies/README.md
//
// Public, static file on GitHub's raw content CDN — no scraping involved.
//
// Produces: scripts/pipeline/data/pc-boundaries-raw.geojson
// Run: node scripts/pipeline/fetch-constituency-boundaries.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { fetchText } from "./lib/http.mjs";

const URL_ =
  "https://raw.githubusercontent.com/datameet/maps/master/parliamentary-constituencies/india_pc_2019_simplified.geojson";
const OUT_DIR = new URL("./data/", import.meta.url);
const OUT_FILE = new URL("./data/pc-boundaries-raw.geojson", import.meta.url);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("Fetching DataMeet Lok Sabha constituency boundaries (CC0)...");
  const text = await fetchText(URL_, { timeoutMs: 30000 });
  const geo = JSON.parse(text);
  if (!Array.isArray(geo.features) || geo.features.length < 500) {
    throw new Error(
      `Expected ~543 constituency features, got ${geo.features?.length ?? 0} — file format may have changed.`,
    );
  }
  await writeFile(OUT_FILE, text);
  console.log(`Wrote ${geo.features.length} constituency boundaries to ${OUT_FILE.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
