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
// Also builds mp-candidates.json: per MP, the full list of candidates who
// contested that constituency (winner + everyone who lost), from
// data/myneta-candidates.json (fetch-myneta-candidates.mjs) — matched by
// normalized constituency name, same as everything else here. MyNeta
// doesn't publish vote counts/margins, so this is affidavit data only
// (party, criminal cases, education, assets/liabilities) with an isWinner
// flag, not a ranked results table.
//
// This is a SEPARATE file from mps-merged.json, not an embedded field on
// each record — 7,441 candidates across 475 constituencies added ~2.6MB to
// mps-merged.json, which is imported eagerly by every page (src/data/mps.ts).
// Keeping it separate lets MPDetail.tsx lazy-load only this file, only when
// a user actually opens an MP's page.
//
// Run: node scripts/pipeline/merge.mjs
// Requires: data/sansad-mps.json, data/prs-mps.json, data/myneta-mps.json,
//           data/mplads-funds.json (produced by the four fetch-*.mjs scripts),
//           data/myneta-candidates.json (optional; produced by
//           fetch-myneta-candidates.mjs — merge proceeds with candidates: []
//           per MP if it hasn't been run yet)

import { readFile, writeFile } from "node:fs/promises";

const DATA_DIR = new URL("./data/", import.meta.url);
const OUT_FILE = new URL("./data/mps-merged.json", import.meta.url);
const OUT_CANDIDATES_FILE = new URL("./data/mp-candidates.json", import.meta.url);

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

// sansad.in's pagination occasionally serves the same MP twice under two
// name formats — "Lastname, Title Firstname" and "Title Firstname
// Lastname" — for the same constituency (verified: 13 constituencies had
// exactly this pattern, e.g. "Baalu, Shri T R" / "Shri T R Baalu" both for
// Sriperumbudur). Left unfixed, both rows carry the same normalized
// constituency id, so every merged record and the geo/map join downstream
// silently duplicate. Dedupe by constituency, preferring the comma-free
// name (the format all ~537 non-duplicated rows already use).
function dedupeSansad(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = normalizeConstituency(row.constituency);
    const existing = byKey.get(key);
    if (!existing || (existing.name.includes(",") && !row.name.includes(","))) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

async function main() {
  const [sansadRaw, prs, myneta, mplads, mynetaCandidatesById] = await Promise.all([
    loadJson("sansad-mps.json"),
    loadJson("prs-mps.json"),
    loadJson("myneta-mps.json"),
    loadJson("mplads-funds.json"),
    loadJson("myneta-candidates.json").then((v) => (Array.isArray(v) ? {} : v)),
  ]);
  const sansad = dedupeSansad(sansadRaw);
  if (sansad.length !== sansadRaw.length) {
    console.log(`Deduped sansad roster: ${sansadRaw.length} -> ${sansad.length} rows.`);
  }

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
  const candidatesByConstituency = new Map();
  for (const entry of Object.values(mynetaCandidatesById)) {
    if (entry.constituencyName) {
      candidatesByConstituency.set(normalizeConstituency(entry.constituencyName), entry.candidates);
    }
  }

  const candidatesById = {};

  const merged = sansad.map((mp) => {
    const key = normalizeConstituency(mp.constituency);
    const prsMatch = prsByConstituency.get(key) ?? null;
    const mynetaMatch = mynetaByConstituency.get(key) ?? null;
    const mpladsMatch = mpladsByConstituency.get(key) ?? null;
    const candidates = candidatesByConstituency.get(key) ?? [];
    const id = key.toLowerCase().replace(/\s+/g, "-");
    if (candidates.length > 0) candidatesById[id] = candidates;

    return {
      id,
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
  const withCandidates = Object.keys(candidatesById).length;

  await writeFile(OUT_FILE, JSON.stringify(merged, null, 2));
  await writeFile(OUT_CANDIDATES_FILE, JSON.stringify(candidatesById, null, 2));
  console.log(`Merged ${merged.length} MPs -> ${OUT_FILE.pathname}`);
  console.log(`  matched to PRS data:    ${withPrs}/${merged.length}`);
  console.log(`  matched to MyNeta data: ${withMyneta}/${merged.length}`);
  console.log(`  matched to MPLADS data: ${withMplads}/${merged.length} (most recent term available: 17th LS 2019-2024 — see fundsDataTerm per record)`);
  console.log(`  matched to full candidate lists: ${withCandidates}/${merged.length} -> ${OUT_CANDIDATES_FILE.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
