// Builds the two geo assets the map UI ships (as .json, not .geojson, so
// Vite's built-in JSON handling picks them up with no extra config):
//   1. src/data/geo/states.json — one dissolved polygon per state/UT, with
//      the leading party, seat count, and total unspent MPLADS funds baked
//      into its properties (for the national landing-page map).
//   2. src/data/geo/pc/<state-slug>.json — one file per state with that
//      state's individual constituency shapes + per-seat MP data (loaded on
//      demand, via import.meta.glob, when a user drills into a state).
//
// Source boundaries: DataMeet's 2019 Lok Sabha delimitation (CC0), fetched
// by fetch-constituency-boundaries.mjs. No redelimitation happened between
// 2019 and 2024 nationally, EXCEPT a few documented exceptions below — this
// script does not silently paper over those, it either aliases to the old
// (still-geometrically-valid) name or leaves the seat unmapped.
//
// Known exceptions (verified against the real per-state name lists in the
// boundary file, not guessed):
//   - Assam renamed three seats in 2023 (same territory, new names):
//     Kaliabor -> Kaziranga, "Autonomous District" -> Diphu,
//     Mangaldoi -> Darrang Udalguri. Boundaries are the pre-rename shapes.
//   - Karnataka officially renamed Belgaum -> Belagavi (2014, unrelated to
//     LS delimitation).
//   - Assam's "Gauhati" and Telangana's "Bhuvanagiri" are the ECI's
//     official/older names for seats commonly called Guwahati / Bhongir.
//   - Jammu & Kashmir's 2022 delimitation merged parts of the old Anantnag
//     and (non-LS) Rajouri area into a new "Anantnag-Rajouri" seat. That
//     exact boundary does not exist in this 2019-delimitation file, so the
//     seat is drawn with the old Anantnag polygon — see the alias note below.
//   - A handful of others are pure spelling differences (Mahbubnagar vs
//     Mahabubnagar, Cooch Behar vs Coochbehar, etc.) — see
//     CONSTITUENCY_ALIASES below for the full list.
//
// State-name reconciliation: our MP data uses current official names
// (Odisha, NCT of Delhi) while the 2019 boundary file predates some of
// those; Ladakh (split from Jammu & Kashmir in Aug 2019, after this
// boundary snapshot) has no st_name here but its seat does exist under
// "Jammu & Kashmir" — see STATE_ALIASES. Dadra & Nagar Haveli and Daman &
// Diu were separate UTs in 2019 (now merged) — their two polygons are
// dissolved together into the single state feature.
//
// Northern boundary: this DataMeet file already uses India's official
// (Survey of India) depiction — verified by point-in-polygon test, the
// Ladakh constituency polygon contains Gilgit, Muzaffarabad, and Aksai
// Chin. Nothing is redrawn or clipped here.
//
// Run: node scripts/pipeline/build-geo.mjs
// Requires: data/pc-boundaries-raw.geojson (fetch-constituency-boundaries.mjs),
//           data/mps-merged.json copied to src/data (or run after pipeline:sync)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as turf from "@turf/turf";

const GEO_RAW_FILE = new URL("./data/pc-boundaries-raw.geojson", import.meta.url);
const MPS_FILE = new URL("../../src/data/mps-merged.json", import.meta.url);
const OUT_DIR = new URL("../../src/data/geo/", import.meta.url);
const OUT_STATES_FILE = new URL("../../src/data/geo/states.json", import.meta.url);
const OUT_PC_DIR = new URL("../../src/data/geo/pc/", import.meta.url);

function normalizeConstituency(name) {
  return name
    .toUpperCase()
    .replace(/\s*\([^)]*\)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// mp.constituency (normalized) -> geo pc_name (normalized), for renames,
// old/official ECI names, and pure spelling differences. Verified against
// the real per-state constituency lists in the boundary file — not guessed.
const CONSTITUENCY_ALIASES = {
  MAHBUBNAGAR: "MAHABUBNAGAR",
  COOCHBEHAR: "COOCH BEHAR",
  BARRACKPUR: "BARRACKPORE",
  "MUMBAI SOUTH CENTRAL": "MUMBAI NORTH CENTRAL",
  SONITPUR: "TEZPUR",
  PEDDAPALLE: "PEDDAPALLI",
  FIROZPUR: "FIROZEPUR",
  MANDSOUR: "MANDSAUR",
  "JANJGIR-CHAMPA": "JANJGIR",
  CHIKKODI: "CHIKODI",
  ANANTAPUR: "ANANTAPURAMU",
  DAVANAGERE: "DAVANGERE",
  GUWAHATI: "GAUHATI",
  ARAMBAG: "ARAMBAGH",
  HASSAN: "HAASAN",
  MAYILADUTHURAI: "MAYILADUTURAI",
  THOOTHUKKUDI: "THOOTHUKUDI",
  ANAKAPALLE: "ANAKAPALLI",
  HARDWAR: "HARIDWAR",
  BHONGIR: "BHUVANAGIRI",
  "DARRANG UDALGURI": "MANGALDOI",
  TIRUVALLUR: "THIRUVALLUR",
  BELGAUM: "BELAGAVI",
  CHIKKBALLAPUR: "CHIKBALLAPUR",
  MAVELIKKARA: "MAVELIKARA",
  KAZIRANGA: "KALIABOR",
  DIPHU: "AUTONOMOUS DISTRICT",
  KANNIYAKUMARI: "KANYAKUMARI",
  // ANANTNAG-RAJOURI is a new 2022-delimitation seat with no exact shape in
  // this 2019 file: it kept most of old Anantnag and absorbed the
  // Rajouri/Poonch belt that previously sat in Jammu/Udhampur. Mapped to the
  // old ANANTNAG polygon — the closest real, non-overlapping shape available.
  // Previously left unmapped, which punched a visible hole in the Kashmir
  // valley on the national map; an approximate-but-documented shape beats a
  // hole. The seat's shape is therefore slightly smaller than reality; the
  // MP, party, and fund figures attached to it are exact.
  "ANANTNAG-RAJOURI": "ANANTNAG",
};

// mp.state -> geo st_name(s). An array means those geo states get dissolved
// together into one state feature (DNH + Daman & Diu merger).
const STATE_ALIASES = {
  Odisha: ["Orissa"],
  "NCT of Delhi": ["Delhi"],
  "Andaman and Nicobar Islands": ["Andaman & Nicobar"],
  "Jammu and Kashmir": ["Jammu & Kashmir"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra & Nagar Haveli", "Daman & Diu"],
  // Ladakh became a separate UT in Aug 2019, after this boundary snapshot,
  // so it has no st_name of its own here — but its single Lok Sabha seat
  // ("Ladakh") IS present, filed under Jammu & Kashmir. Pointing Ladakh at
  // that state name lets the per-constituency lookup below find it, and it
  // still gets grouped into its own state feature (grouping is keyed by
  // mp.state, not the geo name).
  //
  // This matters far more than one seat: the Ladakh PC polygon is 179,000
  // km² — it carries Leh, Kargil, and the whole claimed northern region
  // (Gilgit-Baltistan, PoK, Aksai Chin) that India's official maps include.
  // Dropping it removed most of India's north from the rendered map.
  Ladakh: ["Jammu & Kashmir"],
};

function geoStateNames(mpState) {
  return STATE_ALIASES[mpState] ?? [mpState];
}

// NOTE: party colours are deliberately NOT baked into these files. They are
// derived at render time from src/data/party-colors.ts, which is the single
// source of truth — an earlier copy of the colour function lived here too, and
// the two drifting apart is exactly the failure mode worth designing out.

function stateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  const [geoRaw, mps] = await Promise.all([
    readFile(GEO_RAW_FILE, "utf8").then(JSON.parse),
    readFile(MPS_FILE, "utf8").then(JSON.parse),
  ]);

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(OUT_PC_DIR, { recursive: true });

  const mpByConstituencyKey = new Map(mps.map((mp) => [normalizeConstituency(mp.constituency), mp]));

  function findMp(geoPcName) {
    const key = normalizeConstituency(geoPcName);
    if (mpByConstituencyKey.has(key)) return mpByConstituencyKey.get(key);
    // reverse-lookup: does any alias map an mp constituency to this geo name?
    for (const [mpKey, geoKey] of Object.entries(CONSTITUENCY_ALIASES)) {
      if (geoKey === key && mpByConstituencyKey.has(mpKey)) return mpByConstituencyKey.get(mpKey);
    }
    return null;
  }

  let matched = 0;
  const stateGroups = new Map(); // mp.state -> features[]

  for (const mp of mps) {
    const wantGeoNames = geoStateNames(mp.state);
    const key = normalizeConstituency(mp.constituency);
    const aliasedGeoKey = CONSTITUENCY_ALIASES[key] ?? key;
    const feature = geoRaw.features.find(
      (f) =>
        wantGeoNames.includes(f.properties.st_name) &&
        normalizeConstituency(f.properties.pc_name) === aliasedGeoKey,
    );
    if (!feature) continue;
    matched++;
    if (!stateGroups.has(mp.state)) stateGroups.set(mp.state, []);
    stateGroups.get(mp.state).push({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        mpId: mp.id,
        name: mp.name,
        constituency: mp.constituency,
        party: mp.party,
        grade: null, // computed client-side in src/data/mps.ts; not duplicated here
        fundsUnspentCr: mp.fundsUnspentCr,
        fundsDataTerm: mp.fundsDataTerm,
      },
    });
  }
  console.log(`Matched ${matched}/${mps.length} MPs to a constituency boundary.`);
  void findMp; // kept for potential future reverse-lookup use

  const stateFeatures = [];
  for (const [state, features] of stateGroups) {
    const flat = turf.flatten(turf.featureCollection(features));
    const dissolved = turf.dissolve(flat);
    // dissolve can return multiple pieces if the state's seats aren't all
    // contiguous in this simplified data; combine into one MultiPolygon.
    // dissolve/combine can leave rings with inverted winding order (violates
    // the GeoJSON right-hand rule) — d3-geo's spherical clipping interprets
    // an inverted ring as covering the *complement* of the shape, which
    // rendered as a solid rectangle nearly filling the whole map (verified:
    // this was happening before rewind() was added here). turf.rewind()
    // normalizes winding so d3-geo renders the actual small shape.
    const geometry = turf.rewind(
      dissolved.features.length === 1
        ? dissolved.features[0].geometry
        : turf.combine(dissolved).features[0].geometry,
      { mutate: true },
    );

    const partyCounts = new Map();
    let totalUnspentCr = 0;
    let seatsWithFundsData = 0;
    for (const f of features) {
      partyCounts.set(f.properties.party, (partyCounts.get(f.properties.party) ?? 0) + 1);
      if (f.properties.fundsUnspentCr !== null) {
        totalUnspentCr += f.properties.fundsUnspentCr;
        seatsWithFundsData++;
      }
    }
    const leadingParty = [...partyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    stateFeatures.push({
      type: "Feature",
      geometry,
      properties: {
        state,
        slug: stateSlug(state),
        seatCount: features.length,
        leadingParty,
        totalUnspentCr: Number(totalUnspentCr.toFixed(2)),
        seatsWithFundsData,
      },
    });

    await writeFile(
      new URL(`${stateSlug(state)}.json`, OUT_PC_DIR),
      JSON.stringify({ type: "FeatureCollection", features }),
    );
  }

  // The dissolved state outlines carry a lot of inherited vertex detail
  // from the constituency-level source data that the national overview map
  // doesn't need — simplify before writing to keep the landing-page payload
  // reasonable (drill-down constituency files below stay full precision).
  const simplified = turf.simplify(
    { type: "FeatureCollection", features: stateFeatures },
    { tolerance: 0.02, highQuality: false },
  );
  // simplify() can itself invert thin/complex rings — rewind again after,
  // not just after dissolve/combine above (verified: some rings were still
  // wrong until this second pass was added).
  const statesCollection = turf.rewind(simplified, { mutate: true });

  await writeFile(OUT_STATES_FILE, JSON.stringify(statesCollection));

  console.log(`Wrote ${stateFeatures.length} state boundaries to ${OUT_STATES_FILE.pathname}`);
  console.log(`Wrote per-state constituency files to ${OUT_PC_DIR.pathname}`);
  const unmapped = mps.length - matched;
  if (unmapped > 0) {
    console.log(
      `${unmapped} MP(s) have no boundary shape (see script header for documented gaps).`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
