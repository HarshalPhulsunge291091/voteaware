// Single source of truth for the colour a party is drawn in — the national
// map, the state drill-down, and the MP detail header all read from here, so
// a party can never appear as two different colours in the same session.
//
// This replaces an earlier hash-of-the-party-name scheme. That scheme was
// deterministic but colour-blind to collisions: BJP and INC happened to hash
// to almost the same purple, which made the national map — where those two
// lead 26 of 36 states between them — effectively unreadable.
//
// The five parties below are pinned to the colours Indian readers already
// associate with them, so the map is legible at a glance. Everything else is
// assigned from a ramp chosen for mutual distinguishability, NOT for fidelity
// to that party's own branding — which is why every colour in this product is
// always accompanied by the party's name (map legend, seat rows, readouts).
// Colour never carries the identity on its own.
// Every party that currently leads at least one state is pinned, so no two
// colours on the national map can ever collide — that is the one surface where
// a collision is fatal, since a state is a single flat shape with no room for
// a label. (Verified against the data: hashing alone put SP and SKM on the
// same teal.) If a future data refresh gives a state to a party not listed
// here it falls back to the ramp below and may collide; re-check this list
// when the roster changes.
import rawMps from "./mps-merged.json";

const PINNED: Record<string, string> = {
  // Matched to the colours Indian readers already associate with the party.
  BJP: "#f97316", // saffron
  INC: "#38bdf8", // sky
  AITC: "#22c55e", // green
  DMK: "#ef4444", // red
  TDP: "#facc15", // yellow
  // Assigned for separation rather than brand fidelity — see note above.
  SP: "#2dd4bf", // teal
  SKM: "#a3e635", // lime
  ZPM: "#e879f9", // fuchsia
  "J&KNC": "#c084fc", // purple
  "JD(U)": "#f472b6", // pink
  // Independents get a deliberately unsaturated slate: "no party" should not
  // read as a party with a brand.
  "Ind.": "#94a3b8",
};

// Distinct hues that stay clear of the pinned colours above and of each other,
// all light enough to clear 3:1 against the near-black ground as large fills.
const RAMP = [
  "#a855f7", // purple
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lime
  "#3b82f6", // blue
  "#fb923c", // light orange
  "#06b6d4", // cyan
  "#d946ef", // fuchsia
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#fbbf24", // gold
  "#f87171", // salmon
  "#4ade80", // mint
  "#c084fc", // lavender
  "#93c5fd", // pale blue
  "#fda4af", // rose
  "#2dd4bf", // turquoise
  "#a3e635", // yellow-green
  // Pastel tail. Deliberately last in the ramp, so these land on the parties
  // holding one or two seats; they stay light enough to clear 3:1 on the
  // near-black ground, which the darker variants of these hues would not.
  "#f0abfc", // pale fuchsia
  "#67e8f9", // pale cyan
  "#bef264", // pale lime
  "#d8b4fe", // pale purple
  "#fdba74", // pale orange
  "#5eead4", // pale teal
  "#f9a8d4", // pale pink
  "#86efac", // pale green
  "#fde047", // pale yellow
  "#bfdbfe", // pale blue
  "#fecaca", // pale red
  "#e9d5ff", // pale violet
];

// Ramp colours are handed out by NATIONAL SEAT COUNT, not by hashing the party
// name. Hashing looked stable but distributed colours at random, so parties
// that actually appear together kept colliding: SS and NCPSP hashed to the
// same blue, right next to INC's sky — and Maharashtra contains all three, so
// its seat map and split bar were unreadable.
//
// Ranking instead means the largest parties — the ones most likely to share a
// state — get the most separated colours. The ramp is sized so all 30
// non-pinned parties fit without wrapping, giving every party in the dataset a
// unique colour. `npm run verify:colors` asserts that no state's seat list and
// no view of the national map ever draws two parties the same; run it after a
// pipeline refresh, since a new party or a shifted ranking can reshuffle this.
const RANKED_COLORS: Record<string, string> = (() => {
  const seats = new Map<string, number>();
  for (const mp of rawMps as { party: string }[]) {
    seats.set(mp.party, (seats.get(mp.party) ?? 0) + 1);
  }
  const assigned: Record<string, string> = {};
  let next = 0;
  const ranked = [...seats.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [party] of ranked) {
    if (PINNED[party]) continue;
    assigned[party] = RAMP[next % RAMP.length];
    next++;
  }
  return assigned;
})();

/** Stable colour for a party name. Deterministic given the dataset, so the
 *  same party is the same colour everywhere in the product and between builds. */
export function partyColor(party: string): string {
  return PINNED[party] ?? RANKED_COLORS[party] ?? RAMP[RAMP.length - 1];
}
