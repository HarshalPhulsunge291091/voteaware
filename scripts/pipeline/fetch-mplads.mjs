// Source: MPLADS fund utilization data.
//
// mplads.gov.in itself is unreachable from this dev network (TCP-level
// connection timeout, verified with `curl -v` — not an HTTP block, the host
// never responds at all). That's consistent with .gov.in/.nic.in hosts
// restricting traffic to Indian IP ranges.
//
// data.gov.in mirrors government datasets but its robots.txt disallows all
// crawling (`Disallow: /`) and it actively blocks automated browsers
// (Akamai bot detection) — not a source to build a scraper against.
//
// This script instead pulls the same official MPLADS dataset from
// data.opencity.in, a public CKAN "urban data portal" (OpenCity/DataMeet)
// that mirrors government datasets for civic-tech reuse. Its robots.txt
// (verified) only disallows /api/, /revision/, /dataset/*/history, and
// /dataset/rate/ — the dataset pages and CSV downloads used here are
// unrestricted, and there's no bot-detection wall like data.gov.in's.
//
// Coverage: this mirror has resources for the 16th LS (2014-2019) and 17th
// LS (2019-2024). Nothing for the current 18th LS (2024-) has surfaced yet
// on this mirror as of this writing — MPLADS fund reporting lags the
// term, and a 2024-29 dataset may simply not exist publicly yet. This
// script fetches what's available (17th LS, the most recent) as the best
// currently-obtainable proxy; re-run it periodically and swap in an 18th LS
// resource ID here as soon as one appears.
//
// Produces: scripts/pipeline/data/mplads-funds.json
// Run: node scripts/pipeline/fetch-mplads.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { fetchText } from "./lib/http.mjs";

const OUT_DIR = new URL("./data/", import.meta.url);
const OUT_FILE = new URL("./data/mplads-funds.json", import.meta.url);

// Known-good resource on data.opencity.in as of 2026-08-30. If this dataset
// page structure changes, re-derive the CSV URL from:
// https://data.opencity.in/dataset/lok-sabha-mp-local-area-development-funds-details
const SOURCES = [
  {
    term: "17th Lok Sabha (2019-2024)",
    csvUrl:
      "https://data.opencity.in/dataset/0844e65b-76ff-422b-a213-2495aec592d9/resource/e4524ed7-6c9b-41a5-ad0a-003358fdabca/download/4d2bc892-cd12-4f17-befa-aa7efb6e210b.csv",
  },
  {
    term: "16th Lok Sabha (2014-2019)",
    csvUrl:
      "https://data.opencity.in/dataset/0844e65b-76ff-422b-a213-2495aec592d9/resource/57baaa96-04ca-4328-86bc-17b455af1024/download/d6a40c40-f0bb-44d7-b697-fd4d74ffefd3.csv",
  },
];

// Real CSV parser (quote-aware): the 16th LS file has quoted fields with
// embedded commas (e.g. a "ReasonsforNotRel" column listing multiple
// comma-separated reasons in one quoted cell) — a plain .split(",") would
// silently misalign every column after the first such field.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const clean = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

// Both CSVs have a title block (a "Textbox4" report-header cell, a merged
// title row, blank rows) before the real column header — locate it by
// looking for a row containing a recognizable MP-name column, rather than
// assuming row 0 is the header.
function toRecords(rows) {
  const headerIndex = rows.findIndex((r) =>
    r.some((cell) => /^MP\s*Name$/i.test(cell.trim())),
  );
  if (headerIndex === -1) {
    throw new Error("Could not locate the header row (no 'MP Name' column found) — CSV layout may have changed.");
  }
  const header = rows[headerIndex].map((h) => h.trim());
  return rows.slice(headerIndex + 1).map((cells) => {
    const record = {};
    header.forEach((key, i) => (record[key] = (cells[i] ?? "").trim()));
    return record;
  });
}

function toNumber(str) {
  if (str === undefined || str === "") return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

// The two available terms use different column names/units entirely — map
// each source's raw record to the same shape rather than assuming a shared
// schema.
const COLUMN_MAPS = {
  "17th Lok Sabha (2019-2024)": (r) => ({
    name: r["MP Name"],
    constituency: r["Constituency "] ?? r["Constituency"],
    entitlementCr: toNumber(r["Entitlement"]),
    fundReceivedGoiCr: toNumber(r["FundReceivedGOI"]),
    amountAvailableCr: toNumber(r["AmountAvailable"]),
    worksRecommendedCostCr: toNumber(r["WorksRecommCost"]),
    workSanctionedCostCr: toNumber(r["WSCost"]),
    actualExpenditureCr: toNumber(r["ActualExpenditureIncurred"]),
    utilizationPct: toNumber(r["UtilizationOverRelease"]),
    unspentBalanceCr: toNumber(r["UnspentBalance"]),
  }),
  "16th Lok Sabha (2014-2019)": (r) => ({
    name: r["MPName"],
    constituency: r["Constituency"],
    entitlementCr: toNumber(r["TotalEntitlementAmount_crore"]),
    fundReceivedGoiCr: toNumber(r["TotalGOIRelease_crore"]),
    releasePendingCr: toNumber(r["ReleasePendingAmount_crore"]),
    unsanctionedBalanceCr: toNumber(r["UnSanctionBalance_crore"]),
    unspentBalanceCr: toNumber(r["UnspentBalance_crore"]),
    reasonsForNotReleased: r["ReasonsforNotRel"] || null,
  }),
};

async function fetchSource({ term, csvUrl }) {
  const csv = await fetchText(csvUrl);
  const records = toRecords(parseCsv(csv));
  const mapRow = COLUMN_MAPS[term];
  return records
    .filter((r) => mapRow(r).name && mapRow(r).constituency)
    .map((r) => ({ term, ...mapRow(r), name: mapRow(r).name.trim(), constituency: mapRow(r).constituency.trim() }));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const results = [];
  for (const source of SOURCES) {
    console.log(`Fetching MPLADS data: ${source.term}...`);
    try {
      const rows = await fetchSource(source);
      console.log(`  -> ${rows.length} MP records`);
      results.push(...rows);
    } catch (err) {
      console.warn(`  FAILED (${source.term}): ${err.message}`);
    }
  }

  if (results.length === 0) {
    throw new Error("No MPLADS records fetched from any source — check the CSV URLs are still valid.");
  }

  await writeFile(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} MPLADS fund records to ${OUT_FILE.pathname}`);
  console.log(
    "NOTE: no 18th Lok Sabha (current, 2024-) MPLADS data was found publicly anywhere during " +
      "this build — the 17th LS (2019-2024) figures above are the most recent available and " +
      "describe the PREVIOUS term's MPs, not necessarily the sitting ones in sansad-mps.json. " +
      "Match by constituency, not by assuming the MP is the same person.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
