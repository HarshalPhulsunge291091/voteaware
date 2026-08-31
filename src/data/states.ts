import type { FeatureCollection, Geometry } from "geojson";
import statesGeo from "./geo/states.json";
import { partyColor } from "./party-colors";

/** As stored in geo/states.json — no colour, by design. */
interface RawStateProperties {
  state: string;
  slug: string;
  seatCount: number;
  leadingParty: string;
  totalUnspentCr: number;
  seatsWithFundsData: number;
}

export interface StateProperties extends RawStateProperties {
  leadingPartyColor: string;
}

const raw = statesGeo as unknown as FeatureCollection<Geometry, RawStateProperties>;

// Colour is attached here rather than baked into the file, so party-colors.ts
// stays the only place a party's colour is decided.
export const STATES_GEO: FeatureCollection<Geometry, StateProperties> = {
  ...raw,
  features: raw.features.map((f) => ({
    ...f,
    properties: { ...f.properties, leadingPartyColor: partyColor(f.properties.leadingParty) },
  })),
};

/** Per-state summary rows, for callers that need the numbers without the
 *  geometry (the map legend, national totals). Same objects the map's paths
 *  carry, so a legend and the shape it explains can never disagree. */
export const STATE_SUMMARIES: StateProperties[] = STATES_GEO.features.map((f) => f.properties);
