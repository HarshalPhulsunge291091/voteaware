import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { STATES_GEO, type StateProperties } from "../data/states";

export type { StateProperties };

const WIDTH = 480;
const HEIGHT = 520;

// Total entrance is capped rather than scaled per state: 36 features at 16ms
// lands the last one around 560ms, well inside the "authored entrance" budget.
const STAGGER_MS = 16;

export function IndiaMap({
  onSelectState,
  onHoverState,
  selectedSlug,
  startDelayMs = 0,
}: {
  onSelectState: (props: StateProperties) => void;
  onHoverState?: (props: StateProperties | null) => void;
  selectedSlug: string | null;
  /** Offsets the whole north-to-south entrance so the map can resolve after
   *  the wordmark has landed rather than competing with it. */
  startDelayMs?: number;
}) {
  const geo = STATES_GEO;
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const { path, features, delayBySlug } = useMemo(() => {
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
    const p = geoPath(projection);

    // The country resolves north to south rather than all at once, so the
    // entrance reads as the map assembling itself. Ranked on projected
    // centroid y (screen-space, so it survives the projection's latitude
    // stretching) — not on array order, which is alphabetical by state.
    const ranked = [...geo.features]
      .map((f) => ({ slug: f.properties.slug, y: p.centroid(f)[1] }))
      .filter((r) => Number.isFinite(r.y))
      .sort((a, b) => a.y - b.y);
    const delays = new Map(ranked.map((r, i) => [r.slug, i * STAGGER_MS]));

    return { path: p, features: geo.features, delayBySlug: delays };
  }, [geo]);

  const hoveredFeature = hoveredSlug
    ? features.find((f) => f.properties.slug === hoveredSlug)
    : undefined;

  function hover(props: StateProperties | null) {
    setHoveredSlug(props?.slug ?? null);
    onHoverState?.(props);
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto w-full overflow-visible"
      role="group"
      aria-label="Map of India. Each state is shaded by the party holding the most Lok Sabha (Parliament) seats there — not by which party runs the state government. Select a state to see its constituencies."
      onMouseLeave={() => hover(null)}
    >
      {features.map((feature: Feature<Geometry, StateProperties>) => {
        const d = path(feature);
        if (!d) return null;
        const props = feature.properties;
        const isSelected = props.slug === selectedSlug;
        const isHovered = props.slug === hoveredSlug;
        return (
          <g
            key={props.slug}
            className="map-state-enter"
            style={{ animationDelay: `${startDelayMs + (delayBySlug.get(props.slug) ?? 0)}ms` }}
          >
            <path
              d={d}
              className="map-state focus-visible:outline-none"
              fill={props.leadingPartyColor}
              // The base shape is hidden while lifted — the raised copy on the
              // layer below is drawn from the same path, so leaving both
              // visible would show an unlifted ghost under the lifted edge.
              fillOpacity={isHovered ? 0 : isSelected ? 1 : 0.82}
              stroke={isSelected ? "var(--color-accent-strong)" : "var(--color-ink)"}
              strokeWidth={isSelected ? 1.6 : 0.6}
              strokeOpacity={isHovered ? 0 : 1}
              tabIndex={0}
              role="button"
              aria-label={`${props.state}: ${props.seatCount} Lok Sabha seats, ${props.leadingParty} holds the most, ₹${props.totalUnspentCr.toFixed(1)} crore unspent`}
              onMouseEnter={() => hover(props)}
              onFocus={() => hover(props)}
              onBlur={() => hover(null)}
              onClick={() => onSelectState(props)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectState(props);
                }
              }}
            />
          </g>
        );
      })}

      {/* Lift layer. SVG has no z-index, so the hovered state is re-drawn here,
          above every sibling, instead of being reordered in the list — which
          would move a focused node in the DOM mid-interaction. */}
      {hoveredFeature && (
        <path
          d={path(hoveredFeature) ?? undefined}
          className="map-state-lift"
          fill={hoveredFeature.properties.leadingPartyColor}
          fillOpacity={1}
          stroke="var(--color-text-hi)"
          strokeWidth={1}
          aria-hidden="true"
        />
      )}
    </svg>
  );
}
