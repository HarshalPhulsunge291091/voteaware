// Source: prsindia.org — 18th Lok Sabha MP tracker.
// Public, static HTML, robots.txt allows (only /admin /search /user paths blocked).
// Produces: scripts/pipeline/data/prs-mps.json
//
// Run: node scripts/pipeline/fetch-prs.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { fetchText, sleep } from "./lib/http.mjs";

const BASE = "https://prsindia.org";
const INDEX_PATH = "/mptrack/18th-lok-sabha";
// The paginated index ("/mptrack/18th-lok-sabha?page=N") is a Yii2
// GridView whose pager markup is a JS-hydrated placeholder in the static
// HTML — it always shows "page 10" with next->page=2 regardless of the
// true last page. Direct page=N URLs work fine beyond that, so we discover
// the end by paging until a page returns zero MP links instead of trusting
// the scraped pager.
const INDEX_URL = (page) =>
  `${BASE}/mptrack?slug1=18th-lok-sabha&page=${page}&per-page=9`;
const OUT_DIR = new URL("./data/", import.meta.url);
const OUT_FILE = new URL("./data/prs-mps.json", import.meta.url);

function extractMpSlugs(html) {
  const re = /href="\/mptrack\/18th-lok-sabha\/([a-z0-9-]+)"/g;
  const slugs = new Set();
  let m;
  while ((m = re.exec(html))) slugs.add(m[1]);
  return [...slugs];
}

function pickField(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function parseMpDetail(html, slug) {
  const name =
    pickField(html, /<title>\s*([^<|]+?)\s*[|<]/i) ??
    slug.replace(/-/g, " ");

  const constituency = pickField(
    html,
    /field-label">Constituency\s*:<\/div>\s*([^<]+?)\s*<\/div>/,
  );
  const party = pickField(
    html,
    /field-label">Party\s*:<\/div>\s*<a[^>]*>([^(<]+?)\s*\(/,
  );
  const state = pickField(
    html,
    /mptrack\/18-lok-sabha\?MpTrackSearch%5Bstate%5D=([^"]+)"\s*\??>/,
  );

  const attendancePct = pickField(
    html,
    /field-name-field-attendance field-type-text[\s\S]{0,80}?field-item even">(\d+)\s*%/,
  );
  const debates = pickField(
    html,
    /field-name-field-author field-type-text[\s\S]{0,80}?field-item even">(\d+(?:\.\d+)?)/,
  );
  const questions = pickField(
    html,
    /field-name-field-total-expenses-railway[\s\S]{0,80}?field-item even">(\d+(?:\.\d+)?)/,
  );
  const privateMemberBills = pickField(
    html,
    /field-name-field-source field-type-text[\s\S]{0,80}?field-item even">(\d+(?:\.\d+)?)/,
  );

  return {
    slug,
    sourceUrl: `${BASE}${INDEX_PATH}/${slug}`,
    name,
    constituency,
    state: state ? decodeURIComponent(state) : null,
    party,
    attendancePct: attendancePct ? Number(attendancePct) : null,
    debates: debates ? Number(debates) : null,
    questions: questions ? Number(questions) : null,
    privateMemberBills: privateMemberBills ? Number(privateMemberBills) : null,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Paging through the PRS index until a page comes back empty...");
  const slugs = new Set();
  let page = 1;
  let emptyPages = 0;
  while (emptyPages < 2 && page <= 80) {
    const html = await fetchText(INDEX_URL(page));
    const found = extractMpSlugs(html);
    if (found.length === 0) {
      emptyPages++;
    } else {
      emptyPages = 0;
      for (const slug of found) slugs.add(slug);
    }
    if (page % 10 === 0 || found.length === 0) {
      console.log(`  page ${page}: ${found.length} slugs (total ${slugs.size})`);
    }
    page++;
    await sleep(300);
  }
  console.log(`Discovered ${slugs.size} MP slugs across ${page - 1} pages.`);

  const results = [];
  let i = 0;
  for (const slug of slugs) {
    i++;
    try {
      const html = await fetchText(`${BASE}${INDEX_PATH}/${slug}`);
      results.push(parseMpDetail(html, slug));
    } catch (err) {
      console.warn(`  [${i}/${slugs.size}] FAILED ${slug}: ${err.message}`);
    }
    if (i % 25 === 0) {
      console.log(`  [${i}/${slugs.size}] fetched`);
      // Checkpoint periodically so a stall/interrupt doesn't lose earlier work.
      await writeFile(OUT_FILE, JSON.stringify(results, null, 2));
    }
    await sleep(250);
  }

  await writeFile(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} MP records to ${OUT_FILE.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
