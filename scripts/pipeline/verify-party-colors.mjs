// Asserts the invariant the colour scheme exists to guarantee: no single view
// — a state's seat list, or the national map — ever draws two parties in the
// same colour. Exits non-zero if that breaks.
//
// Worth running after any pipeline refresh: colours are handed out by national
// seat rank, so a new party entering the data (or a by-election shifting the
// ranking) can reshuffle assignments and reintroduce a collision. Two were
// caught this way already — SS/NCPSP sharing a blue inside Maharashtra, and
// later BAP/CPI(M) in Rajasthan and HAM(S)/RJD in Bihar from ramp wrap-around.
//
// It re-derives the palette by reading src/data/party-colors.ts as text rather
// than importing it, since that module is TypeScript with a bare JSON import
// that plain node won't resolve. Keep the RAMP/PINNED declarations in the
// shapes matched below.
//
// Run: node scripts/pipeline/verify-party-colors.mjs   (npm run verify:colors)
import { readFile } from "node:fs/promises";
const src = await readFile("src/data/party-colors.ts", "utf8");
const rampBlock = src.split("const RAMP = [")[1].split("];")[0];
const ramp = [...rampBlock.matchAll(/"(#[0-9a-f]{6})"/gi)].map(m => m[1]);
const pinnedBlock = src.split("const PINNED: Record<string, string> = {")[1].split("};")[0];
const pinned = Object.fromEntries([...pinnedBlock.matchAll(/"?([A-Za-z&().\- ]+?)"?:\s*"(#[0-9a-f]{6})"/g)].map(m => [m[1].trim(), m[2]]));

const mps = JSON.parse(await readFile("src/data/mps-merged.json", "utf8"));
const seats = new Map();
for (const m of mps) seats.set(m.party, (seats.get(m.party) ?? 0) + 1);
const assigned = {};
let next = 0;
for (const [party] of [...seats.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))) {
  if (pinned[party]) continue;
  assigned[party] = ramp[next % ramp.length];
  next++;
}
const color = (p) => pinned[p] ?? assigned[p] ?? ramp[ramp.length-1];

console.log(`pinned: ${Object.keys(pinned).length}, ramp: ${ramp.length}, parties: ${seats.size}`);

let failures = 0;
// 1. national map: one colour per leading party
const geo = JSON.parse(await readFile("src/data/geo/states.json", "utf8"));
const leadSeen = new Map();
for (const f of geo.features) {
  const p = f.properties.leadingParty, c = color(p);
  if (leadSeen.has(c) && leadSeen.get(c) !== p) { console.log(`FAIL national: ${p} and ${leadSeen.get(c)} share ${c}`); failures++; }
  leadSeen.set(c, p);
}
// 2. every state's seat list
const byState = new Map();
for (const m of mps) {
  if (!byState.has(m.state)) byState.set(m.state, new Set());
  byState.get(m.state).add(m.party);
}
for (const [state, parties] of byState) {
  const seen = new Map();
  for (const p of parties) {
    const c = color(p);
    if (seen.has(c)) { console.log(`FAIL ${state}: ${p} and ${seen.get(c)} share ${c}`); failures++; }
    seen.set(c, p);
  }
}
console.log(failures === 0 ? "PASS: no colour collision in any state or on the national map" : `${failures} COLLISIONS`);

if (failures > 0) process.exitCode = 1;
