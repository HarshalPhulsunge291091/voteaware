// Source: myneta.info — ADR/MyNeta affidavit data for winners of Lok Sabha 2024.
// Public, static HTML. robots.txt only blocks printer/print query params.
// Produces: scripts/pipeline/data/myneta-mps.json
//
// Run: node scripts/pipeline/fetch-myneta.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { fetchText } from "./lib/http.mjs";

const URL_ =
  "https://www.myneta.info/LokSabha2024/index.php?action=show_winners";
const OUT_DIR = new URL("./data/", import.meta.url);
const OUT_FILE = new URL("./data/myneta-mps.json", import.meta.url);

const ROW_RE =
  /<tr(?:\s+class=alt)?\s*>\s*<td>\d+<\/td>\s*<td><a href=\/candidate\.php\?candidate_id=(\d+)>.*?>([^<]+)<\/a><\/a><b><\/td><td>([^<]+)<\/td>\s*<td>([^<]*)<\/td>\s*<td[^>]*>(?:<span[^>]*><b>\s*(\d+)\s*<\/b><\/span>|(\d+))<\/td>\s*<td\s*>([^<]*)<\/td>\s*<td[^>]*>Rs&nbsp;([\d,]+)(?:<br>[\s\S]*?)?<\/td>\s*<td[^>]*>Rs&nbsp;([\d,]+)/g;

function parseRupees(str) {
  if (!str) return null;
  return Number(str.replace(/,/g, ""));
}

function parseWinners(html) {
  const results = [];
  let m;
  while ((m = ROW_RE.exec(html))) {
    const [
      ,
      candidateId,
      name,
      constituency,
      party,
      criminalCasesBadge,
      criminalCasesPlain,
      education,
      assets,
      liabilities,
    ] = m;
    results.push({
      candidateId: Number(candidateId),
      sourceUrl: `https://www.myneta.info/LokSabha2024/candidate.php?candidate_id=${candidateId}`,
      name: name.trim(),
      constituency: constituency.trim(),
      party: party.trim() || null,
      criminalCases: Number(criminalCasesBadge ?? criminalCasesPlain ?? 0),
      education: education.trim() || null,
      totalAssetsRs: parseRupees(assets),
      liabilitiesRs: parseRupees(liabilities),
    });
  }
  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("Fetching MyNeta LokSabha 2024 winners list...");
  const html = await fetchText(URL_);
  const results = parseWinners(html);
  console.log(`Parsed ${results.length} winner records.`);
  if (results.length < 500) {
    console.warn(
      "Expected ~543 rows (one per LS constituency) — got fewer. The row regex may be out of sync with the current page markup; re-check against a saved sample before trusting this run.",
    );
  }
  await writeFile(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} records to ${OUT_FILE.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
