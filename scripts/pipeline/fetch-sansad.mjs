// Source: sansad.in — official Lok Sabha members roster.
// This page is a client-rendered React/Next.js app (table rows are empty
// skeletons in the raw HTML; data loads via an in-page fetch after hydration).
// robots.txt has no restrictions, so we render it with a real browser
// (Playwright) rather than trying to reverse-engineer/replay its internal API.
// Produces: scripts/pipeline/data/sansad-mps.json
//
// Run: node scripts/pipeline/fetch-sansad.mjs
// Requires: `npx playwright install chromium` (already installed in this repo's devDependency).

import { writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const URL_ = "https://sansad.in/ls/members";
const OUT_DIR = new URL("./data/", import.meta.url);
const OUT_FILE = new URL("./data/sansad-mps.json", import.meta.url);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  // "networkidle" never fires on this app (it keeps a live connection open);
  // wait for the basic load event instead, then poll for real table rows.
  await page.goto(URL_, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("table tbody tr td", { timeout: 60000 });

  async function readRows() {
    return page.$$eval("table tbody tr", (trs) =>
      trs
        .map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim()),
        )
        .filter((cells) => cells.length >= 6 && cells[1]),
    );
  }

  const allRows = [];
  const seenSlNos = new Set();
  let pageNum = 1;
  let consecutiveEmpty = 0;
  // The table paginates client-side; walk "next page" until it's disabled.
  while (true) {
    await page.waitForTimeout(1000); // let the current page's rows settle/hydrate
    const rows = await readRows();
    const freshRows = rows.filter((cells) => !seenSlNos.has(cells[0]));
    for (const cells of freshRows) seenSlNos.add(cells[0]);
    allRows.push(...freshRows);
    console.log(`Page ${pageNum}: captured ${freshRows.length} new rows (total ${allRows.length})`);

    if (freshRows.length === 0) {
      consecutiveEmpty++;
      // Hydration can be slow on the first page — give it a few extra chances
      // before concluding pagination is exhausted.
      if (consecutiveEmpty < 5) continue;
      break;
    }
    consecutiveEmpty = 0;

    const nextButton = await page.$('button[aria-label="Go to next page"]:not([disabled])');
    if (!nextButton) break;
    await nextButton.click();
    pageNum++;
    if (pageNum > 60) break; // safety cap; 543 MPs / ~10 per page ≈ 55 pages
  }

  await browser.close();

  if (allRows.length === 0) {
    throw new Error(
      "Captured zero rows — the table's column layout or pagination control likely changed. " +
        "Inspect the live page structure again before trusting this script.",
    );
  }

  // Confirmed column order (verified against the live page on 2026-08-30):
  // [slNo, name, party, constituency, state, status, termsServed, photoUrlPlaceholder]
  //
  // The page also renders a second, hidden detail table with a different
  // schema (DOB/party/full-postal-address) that our generic "table tbody tr"
  // selector also picks up once pagination triggers it. Those rows are
  // reliably identifiable because their "party" cell is a YYYY-MM-DD date —
  // filter them out rather than trying to scope the selector to one table,
  // since the DOM id/class for the correct table isn't stable across builds.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const mps = allRows
    .filter((cells) => !DATE_RE.test(cells[2]))
    .map((cells) => ({
      slNo: cells[0],
      name: cells[1],
      party: cells[2],
      constituency: cells[3].replace(/\s+/g, " ").trim(),
      state: cells[4],
      status: cells[5],
      termsServed: cells[6],
    }));

  const uniqueByName = new Map(mps.map((mp) => [mp.name, mp]));
  const deduped = [...uniqueByName.values()];

  console.log(
    `Filtered ${allRows.length} raw rows -> ${mps.length} well-formed -> ${deduped.length} unique MPs.`,
  );
  if (deduped.length < 500 || deduped.length > 550) {
    console.warn(
      `Expected ~543 Lok Sabha MPs, got ${deduped.length}. Spot-check data/sansad-mps.json before trusting this run.`,
    );
  }

  await writeFile(OUT_FILE, JSON.stringify(deduped, null, 2));
  console.log(`Wrote ${deduped.length} MP records to ${OUT_FILE.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
