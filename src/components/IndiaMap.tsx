import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import statesGeo from "../data/geo/states.json";

export interface StateProperties {
  state: string;
  slug: string;
  seatCount: number;
  leadingParty: string;
  leadingPartyColor: string;
  totalUnspentCr: number;
  seatsWithFundsData: number;
}

const WIDTH = 480;
const HEIGHT = 520;

export function IndiaMap({
  onSelectState,
  selectedSlug,
}: {
  onSelectState: (props: StateProperties) => void;
  selectedSlug: string | null;
}) {
  const geo = statesGeo as FeatureCollection<Geometry, StateProperties>;

  const { path, features } = useMemo(() => {
    // d3-geo's default antimeridian pre-clip misfires on some of these
    // dissolved/simplified state polygons (confirmed: it inserted a bogus
    // "trace the whole clip rectangle" subpath into every feature, which
    // rendered as a solid block covering the map). None of this data is
    // anywhere near the antimeridian, so disabling pre-clip is safe here.
    // Must happen BEFORE fitSize — fitSize computes bounds using whatever
    // preclip is set at the time it's called, so setting it after left
    // fitSize calibrated against the buggy (much larger) bogus bounds,
    // rendering the real geometry tiny.
    const projection = geoMercator().preclip((x) => x).fitSize([WIDTH, HEIGHT], geo);
    return { path: geoPath(projection), features: geo.features };
  }, [geo]);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto w-full max-w-md"
      role="img"
      aria-label="Map of India, states shaded by the party holding the most Lok Sabha seats"
    >
      {features.map((feature: Feature<Geometry, StateProperties>) => {
        const d = path(feature);
        if (!d) return null;
        const isSelected = feature.properties.slug === selectedSlug;
        return (
          <path
            key={feature.properties.slug}
            d={d}
            fill={feature.properties.leadingPartyColor}
            fillOpacity={isSelected ? 1 : 0.85}
            stroke="var(--color-ink)"
            strokeWidth={isSelected ? 1.5 : 0.6}
            className="cursor-pointer transition-[fill-opacity] hover:fill-opacity-100"
            onClick={() => onSelectState(feature.properties)}
          >
            <title>
              {feature.properties.state} — {feature.properties.leadingParty} leads (
              {feature.properties.seatCount} seats) — ₹{feature.properties.totalUnspentCr.toFixed(1)} Cr
              unspent
            </title>
          </path>
        );
      })}
    </svg>
  );
}
