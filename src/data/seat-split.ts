import { partyColor } from "./party-colors";

export interface SeatSplitEntry {
  party: string;
  seats: number;
  color: string;
}

/**
 * Seats won per party, largest first (ties broken alphabetically so the order
 * is stable between renders).
 *
 * This exists because shading a state by its single largest party overstates
 * how one-sided that state is: Maharashtra's largest Lok Sabha party holds 13
 * of 47 seats — 28% — but renders as one flat colour. Anywhere the map claims
 * a party "leads", the full split should be visible next to it.
 */
export function seatSplit(parties: string[]): SeatSplitEntry[] {
  const counts = new Map<string, number>();
  for (const party of parties) counts.set(party, (counts.get(party) ?? 0) + 1);
  return [...counts.entries()]
    .map(([party, seats]) => ({ party, seats, color: partyColor(party) }))
    .sort((a, b) => b.seats - a.seats || a.party.localeCompare(b.party));
}

/** "INC 13 · SS 12 · BJP 9 · +4 more" — short enough for a one-line readout. */
export function summariseSplit(split: SeatSplitEntry[], show = 3): string {
  const head = split
    .slice(0, show)
    .map((e) => `${e.party} ${e.seats}`)
    .join(" · ");
  const rest = split.length - show;
  return rest > 0 ? `${head} · +${rest} more` : head;
}
