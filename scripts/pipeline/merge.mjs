// Joins four verified sources into one record per MP, keyed by normalized
// constituency name: sansad.in roster, PRS performance stats, MyNeta/ADR
// affidavits, and MPLADS fund utilization (via data.opencity.in — see
// fetch-mplads.mjs for why not mplads.gov.in directly).
//
// IMPORTANT CAVEAT ON MPLADS DATA: the most recent term available from that
// source is the 17th Lok Sabha (2019-2024) — the PREVIOUS term. No 18th LS
// (current, 2024-) MPLADS dataset has surfaced publicly yet. So fund figures
// here describe whoever held that constituency's seat in 2019-2024, which
// for re-elected MPs is the same person and for everyone else is their
// predecessor — this is a stand-in until real current-term data exists, not
// a live figure for the sitting MP. Every merged record carries
// `fundsDataTerm` so this is never silently presented as current.
//
// Run: node scripts/pipeline/merge.mjs
// Requires: data/sansad-mps.json, data/prs-mps.json, data/myneta-mps.json,
//           data/mplads-funds.json (produced by the four fetch-*.mjs scripts)

import { readFile, writeFile } from "node:fs/promises";

const DATA_DIR = new URL("./data/", import.meta.url);
const OUT_FILE = new URL("./data/mps-merged.json", import.meta.url);

function normalizeConstituency(name) {
  return name
    .toUpperCase()
    .replace(/\s*\([^)]*\)\s*/g, "") // drop reservation markers: (SC), (ST)
    .replace(/\s+/g, " ")
    .trim();
}

async function loadJson(name) {
  try {
    return JSON.parse(await readFile(new URL(name, DATA_DIR), "utf8"));
  } catch (err) {
    console.warn(`Could not read ${name}: ${err.message}. Run its fetcher first.`);
    return [];
  }
}

async function main() {
  const [sansad, prs, myneta, mplads] = await Promise.all([
    loadJson("sansad-mps.json"),
    loadJson("prs-mps.json"),
    loadJson("myneta-mps.json"),
    loadJson("mplads-funds.json"),
  ]);

  const prsByConstituency = new Map(
    prs.filter((r) => r.constituency).map((r) => [normalizeConstituency(r.constituency), r]),
  );
  const mynetaByConstituency = new Map(
    myneta.filter((r) => r.constituency).map((r) => [normalizeConstituency(r.constituency), r]),
  );
  // Prefer the most recent term (17th LS) per constituency; fall back to
  // 16th LS only if 17th has no entry for that seat.
  const mpladsByConstituency = new Map();
  for (const r of [...mplads].reverse()) {
    if (r.constituency) mpladsByConstituency.set(normalizeConstituency(r.constituency), r);
  }

  const merged = sansad.map((mp) => {
    const key = normalizeConstituency(mp.constituency);
    const prsMatch = prsByConstituency.get(key) ?? null;
    const mynetaMatch = mynetaByConstituency.get(key) ?? null;
    const mpladsMatch = mpladsByConstituency.get(key) ?? null;

    return {
      id: key.toLowerCase().replace(/\s+/g, "-"),
      name: mp.name,
      constituency: mp.constituency,
      state: mp.state,
      party: mp.party,
      status: mp.status,
      termsServed: mp.termsServed,

      // From PRS (18th Lok Sabha tracker) — null if no constituency match found.
      attendancePct: prsMatch?.attendancePct ?? null,
      debates: prsMatch?.debates ?? null,
      questions: prsMatch?.questions ?? null,
      privateMemberBills: prsMatch?.privateMemberBills ?? null,
      prsSourceUrl: prsMatch?.sourceUrl ?? null,

      // From MyNeta/ADR affidavits — null if no constituency match found.
      criminalCases: mynetaMatch?.criminalCases ?? null,
      education: mynetaMatch?.education ?? null,
      totalAssetsRs: mynetaMatch?.totalAssetsRs ?? null,
      liabilitiesRs: mynetaMatch?.liabilitiesRs ?? null,
      mynetaSourceUrl: mynetaMatch?.sourceUrl ?? null,

      // MPLADS fund utilization — from data.opencity.in (see fetch-mplads.mjs).
      // fundsDataTerm tells you which Lok Sabha term these figures actually
      // describe; as of this build the best available is the 17th LS
      // (2019-2024), the PREVIOUS term, not necessarily this sitting MP.
      fundsDataTerm: mpladsMatch?.term ?? null,
      fundsEntitledCr: mpladsMatch?.entitlementCr ?? null,
      fundsReceivedCr: mpladsMatch?.fundReceivedGoiCr ?? null,
      fundsSpentCr: mpladsMatch?.actualExpenditureCr ?? null,
      fundsUnspentCr: mpladsMatch?.unspentBalanceCr ?? null,
      fundsUtilizationPct: mpladsMatch?.utilizationPct ?? null,
      works: [],
    };
  });

  const withPrs = merged.filter((m) => m.attendancePct !== null).length;
  const withMyneta = merged.filter((m) => m.criminalCases !== null).length;
  const withMplads = merged.filter((m) => m.fundsDataTerm !== null).length;

  await writeFile(OUT_FILE, JSON.stringify(merged, null, 2));
  console.log(`Merged ${merged.length} MPs -> ${OUT_FILE.pathname}`);
  console.log(`  matched to PRS data:    ${withPrs}/${merged.length}`);
  console.log(`  matched to MyNeta data: ${withMyneta}/${merged.length}`);
  console.log(`  matched to MPLADS data: ${withMplads}/${merged.length} (most recent term available: 17th LS 2019-2024 — see fundsDataTerm per record)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
