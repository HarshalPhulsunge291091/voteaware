// Source: myneta.info — full per-constituency candidate lists (winner +
// everyone who contested and lost), for Lok Sabha 2024.
//
// myneta.info doesn't publish vote counts/margins (it's ADR's affidavit
// database, not an election-results site) — confirmed by checking a losing
// candidate's detail page, which has no vote figures at all. So this script
// captures what MyNeta actually has per candidate: party, criminal cases,
// education, age, declared assets/liabilities, and whether they won.
//
// Uses Playwright (not a plain fetch) because the show_candidates page
// renders some rows via inline document.write() calls with obfuscated
// payloads — same category as sansad.in's JS-rendered roster we already
// handle this way, not a bot-detection wall: no login, no CAPTCHA, no rate
// limiting, and the obfuscated rows contain the exact same markup as the
// plain ones once rendered (verified by decoding a sample by hand). A plain
// HTTP fetch silently drops those rows (confirmed: Nagpur has 26 candidates
// in the rendered DOM vs. 22 in raw HTML), so Playwright is required for a
// complete list, not optional.
//
// Two-step fetch, because MyNeta's winners list doesn't expose a
// constituency_id directly:
//   1. For each winner we already have (data/myneta-mps.json, from
//      fetch-myneta.mjs), fetch their candidate.php page (plain HTTP is
//      fine here — no obfuscation on this page) and pull the
//      constituency_id out of its "view all candidates" link.
//   2. For each unique constituency_id, render
//      index.php?action=show_candidates&constituency_id=N in a real page
//      and read the fully-rendered table.
//
// Public, static HTML. robots.txt only blocks printer/print query params
// (verified) — no login required anywhere in this flow.
//
// Produces: scripts/pipeline/data/myneta-candidates.json
//   { [constituencyId]: { constituencyId, constituencyName, candidates: [...] } }
//
// Run: node scripts/pipeline/fetch-myneta-candidates.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { fetchText, sleep } from "./lib/http.mjs";

const DATA_DIR = new URL("./data/", import.meta.url);
const WINNERS_FILE = new URL("./data/myneta-mps.json", import.meta.url);
const OUT_FILE = new URL("./data/myneta-candidates.json", import.meta.url);

const CONSTITUENCY_ID_RE = /show_candidates&constituency_id=(\d+)/;

function parseRupees(cellText) {
  const m = cellText.match(/Rs\s*([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

async function findConstituencyId(candidateId) {
  const html = await fetchText(
    `https://www.myneta.info/LokSabha2024/candidate.php?candidate_id=${candidateId}`,
  );
  const m = html.match(CONSTITUENCY_ID_RE);
  return m ? Number(m[1]) : null;
}

async function fetchConstituencyCandidates(page, constituencyId) {
  await page.goto(
    `https://www.myneta.info/LokSabha2024/index.php?action=show_candidates&constituency_id=${constituencyId}`,
    { waitUntil: "load", timeout: 30000 },
  );
  const constituencyName = await page
    .$eval("title", (el) => el.textContent)
    .then((t) => t?.match(/List of Candidates in ([^:]+):/)?.[1]?.trim() ?? null);

  const rows = await page.$$eval("table.w3-table tr", (trs) =>
    trs.slice(1).map((tr) => {
      const tds = [...tr.querySelectorAll("td")];
      const nameCell = tds[1];
      const href = nameCell?.querySelector("a")?.getAttribute("href") ?? "";
      return {
        candidateHref: href,
        rawName: nameCell?.textContent.trim() ?? "",
        party: tds[2]?.textContent.trim() ?? "",
        criminalCases: tds[3]?.textContent.trim() ?? "",
        education: tds[4]?.textContent.trim() ?? "",
        age: tds[5]?.textContent.trim() ?? "",
        assets: tds[6]?.textContent.trim() ?? "",
        liabilities: tds[7]?.textContent.trim() ?? "",
      };
    }),
  );

  const candidates = rows.map((r) => {
    const candidateId = Number(r.candidateHref.match(/candidate_id=(\d+)/)?.[1]);
    const isWinner = /Winner/.test(r.rawName);
    const name = r.rawName.replace(/Winner\s*$/, "").trim();
    return {
      candidateId,
      sourceUrl: `https://www.myneta.info/LokSabha2024/candidate.php?candidate_id=${candidateId}`,
      name,
      isWinner,
      party: r.party || null,
      criminalCases: Number(r.criminalCases) || 0,
      education: r.education || null,
      age: r.age ? Number(r.age) : null,
      totalAssetsRs: parseRupees(r.assets),
      liabilitiesRs: parseRupees(r.liabilities),
    };
  });

  return { constituencyName, candidates };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const winners = JSON.parse(await readFile(WINNERS_FILE, "utf8"));
  console.log(`Loaded ${winners.length} winners; resolving constituency_id for each...`);

  const constituencyIds = new Set();
  let resolved = 0;
  for (const winner of winners) {
    try {
      const cid = await findConstituencyId(winner.candidateId);
      if (cid !== null) constituencyIds.add(cid);
    } catch (err) {
      console.warn(`  FAILED resolving constituency_id for candidate ${winner.candidateId}: ${err.message}`);
    }
    resolved++;
    if (resolved % 25 === 0) console.log(`  [${resolved}/${winners.length}] resolved`);
    await sleep(200);
  }
  console.log(`Resolved ${constituencyIds.size} unique constituency_ids.`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = {};
  let i = 0;
  for (const cid of constituencyIds) {
    i++;
    try {
      const { constituencyName, candidates } = await fetchConstituencyCandidates(page, cid);
      result[cid] = { constituencyId: cid, constituencyName, candidates };
    } catch (err) {
      console.warn(`  FAILED fetching constituency_id=${cid}: ${err.message}`);
    }
    if (i % 25 === 0) {
      console.log(`  [${i}/${constituencyIds.size}] constituencies fetched`);
      await writeFile(OUT_FILE, JSON.stringify(result, null, 2));
    }
    await sleep(150);
  }
  await browser.close();

  await writeFile(OUT_FILE, JSON.stringify(result, null, 2));
  const totalCandidates = Object.values(result).reduce((sum, c) => sum + c.candidates.length, 0);
  console.log(
    `Wrote ${Object.keys(result).length} constituencies (${totalCandidates} total candidates) to ${OUT_FILE.pathname}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
