import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { StateProperties } from "./IndiaMap";

interface ConstituencyProperties {
  mpId: string;
  name: string;
  constituency: string;
  party: string;
  partyColor: string;
  fundsUnspentCr: number | null;
  fundsDataTerm: string | null;
}

const pcModules = import.meta.glob<{ default: FeatureCollection<Geometry, ConstituencyProperties> }>(
  "../data/geo/pc/*.json",
);

const WIDTH = 360;
const HEIGHT = 360;

export function StatePanel({ state, onClose }: { state: StateProperties; onClose: () => void }) {
  const [geo, setGeo] = useState<FeatureCollection<Geometry, ConstituencyProperties> | null>(null);
  const [hovered, setHovered] = useState<ConstituencyProperties | null>(null);

  useEffect(() => {
    setGeo(null);
    setHovered(null);
    const loader = pcModules[`../data/geo/pc/${state.slug}.json`];
    loader?.().then((mod) => setGeo(mod.default));
  }, [state.slug]);

  const path = useMemo(() => {
    if (!geo) return null;
    // See IndiaMap.tsx — preclip must be set BEFORE fitSize, since fitSize
    // calibrates scale against whichever preclip is active when it's called.
    const projection = geoMercator().preclip((x) => x).fitSize([WIDTH, HEIGHT], geo);
    return geoPath(projection);
  }, [geo]);

  const seats = useMemo(
    () => [...(geo?.features ?? [])].sort((a, b) => a.properties.constituency.localeCompare(b.properties.constituency)),
    [geo],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${state.state} constituencies`}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-7"
        style={{ background: "var(--color-ink-card)", boxShadow: "var(--shadow-raised)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--color-text-hi)]">{state.state}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-mid)]">
              {state.leadingParty} leads with the most seats · {state.seatCount} Lok Sabha
              constituencies
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--color-text-mid)] hover:bg-[var(--color-ink-raised)] hover:text-[var(--color-text-hi)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 rounded-xl bg-[var(--color-ink-raised)] px-4 py-3 text-sm text-[var(--color-text-mid)]">
          <span className="font-display text-lg font-bold text-[var(--color-warn)]">
            ₹{state.totalUnspentCr.toFixed(1)} Cr
          </span>{" "}
          unspent MPLADS funds across {state.seatsWithFundsData}/{state.seatCount} seats with matched
          fund records (17th Lok Sabha, 2019–2024 — see each MP's page for the exact term).
        </p>

        {!geo ? (
          <p className="mt-6 text-sm text-[var(--color-text-low)]">Loading constituency map…</p>
        ) : (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="mx-auto mt-6 w-full max-w-xs"
            role="img"
            aria-label={`Constituencies of ${state.state}, shaded by winning party`}
          >
            {geo.features.map((feature: Feature<Geometry, ConstituencyProperties>) => {
              const d = path?.(feature);
              if (!d) return null;
              return (
                <path
                  key={feature.properties.mpId}
                  d={d}
                  fill={feature.properties.partyColor}
                  fillOpacity={hovered?.mpId === feature.properties.mpId ? 1 : 0.85}
                  stroke="var(--color-ink)"
                  strokeWidth={0.5}
                  onMouseEnter={() => setHovered(feature.properties)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <title>
                    {feature.properties.constituency} — {feature.properties.name} (
                    {feature.properties.party})
                  </title>
                </path>
              );
            })}
          </svg>
        )}

        {geo && (
          <ul className="mt-6 divide-y divide-[var(--color-ink-border)] overflow-hidden rounded-2xl border border-[var(--color-ink-border)]">
            {seats.map((f) => (
              <li key={f.properties.mpId}>
                <Link
                  to={`/mps/${f.properties.mpId}`}
                  onClick={onClose}
                  className="flex items-center justify-between gap-4 bg-[var(--color-ink-raised)] px-4 py-3 transition-colors hover:bg-[var(--color-ink)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-text-hi)]">
                      {f.properties.constituency}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-low)]">
                      {f.properties.name} · {f.properties.party}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-sm font-semibold text-[var(--color-text-hi)]">
                    {f.properties.fundsUnspentCr !== null
                      ? `₹${f.properties.fundsUnspentCr.toFixed(1)} Cr unspent`
                      : "—"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
