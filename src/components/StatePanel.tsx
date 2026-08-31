import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { StateProperties } from "../data/states";
import { partyColor } from "../data/party-colors";
import { seatSplit } from "../data/seat-split";
import { getMPById, spentPctOfEntitlement, constituencyLabel } from "../data/mps";
import { SeatSplitBar } from "./SeatSplitBar";

interface ConstituencyProperties {
  mpId: string;
  name: string;
  constituency: string;
  party: string;
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

  // Escape closes, and the page behind stops scrolling while the panel owns
  // the screen — otherwise a trackpad flick scrolls the feed underneath.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

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

  const split = useMemo(
    () => seatSplit((geo?.features ?? []).map((f) => f.properties.party)),
    [geo],
  );

  const hoveredSeat = hovered
    ? geo?.features.find((f) => f.properties.mpId === hovered.mpId)
    : undefined;

  return (
    <div
      className="panel-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-ink)_78%,transparent)] px-4 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${state.state} constituencies`}
    >
      <div
        className="panel-sheet max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-7"
        style={{ background: "var(--color-ink-card)", boxShadow: "var(--shadow-raised)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-[var(--color-text-hi)]">{state.state}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-mid)]">
              {state.seatCount} Lok Sabha constituencies · {state.leadingParty} holds the most
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

        {/* The full seat split, so a plurality is never mistaken for a sweep —
            the map paints each state a single colour, which badly overstates a
            close state. */}
        {split.length > 0 && (
          <div className="mt-4">
            <SeatSplitBar split={split} />
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {split.map((entry) => (
                <li
                  key={entry.party}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-mid)]"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: entry.color }}
                    aria-hidden="true"
                  />
                  {entry.party}
                  <span className="tabular text-[var(--color-text-low)]">{entry.seats}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-low)]">
              Lok Sabha (Parliament) seats from the 2024 general election. This is not the state
              assembly and not which party runs the state government — those are separate
              elections, and are often held by a different party.
            </p>
          </div>
        )}

        <p className="mt-4 rounded-xl bg-[var(--color-ink-raised)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-mid)]">
          <span className="font-display text-lg font-bold text-[var(--color-warn)]">
            ₹{state.totalUnspentCr.toFixed(1)} Cr
          </span>{" "}
          unspent MPLADS funds across {state.seatsWithFundsData}/{state.seatCount} seats with matched
          fund records. These are 17th Lok Sabha figures (2019–2024) — the previous term, and the
          most recent one with published MPLADS data, so for MPs elected in 2024 they describe
          their predecessor in that seat. See each MP's page for the exact term.
        </p>

        {/* Height is reserved while the per-state geometry loads, so the seat
            list below doesn't jump down when the map arrives. */}
        <div className="mt-6 flex flex-col items-center" style={{ minHeight: HEIGHT * 0.72 }}>
          {!geo ? (
            <p className="mt-12 text-sm text-[var(--color-text-low)]">Loading constituency map…</p>
          ) : (
            <>
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full max-w-xs overflow-visible"
                role="img"
                aria-label={`Constituencies of ${state.state}, shaded by winning party`}
                onMouseLeave={() => setHovered(null)}
              >
                {geo.features.map((feature: Feature<Geometry, ConstituencyProperties>) => {
                  const d = path?.(feature);
                  if (!d) return null;
                  const isHovered = hovered?.mpId === feature.properties.mpId;
                  return (
                    <path
                      key={feature.properties.mpId}
                      d={d}
                      className="map-state"
                      fill={partyColor(feature.properties.party)}
                      fillOpacity={isHovered ? 0 : 0.82}
                      stroke="var(--color-ink)"
                      strokeWidth={0.5}
                      strokeOpacity={isHovered ? 0 : 1}
                      onMouseEnter={() => setHovered(feature.properties)}
                    />
                  );
                })}

                {/* Same lift-layer technique as IndiaMap — see the note there. */}
                {hoveredSeat && (
                  <path
                    d={path?.(hoveredSeat) ?? undefined}
                    className="map-state-lift"
                    fill={partyColor(hoveredSeat.properties.party)}
                    stroke="var(--color-text-hi)"
                    strokeWidth={0.9}
                    aria-hidden="true"
                  />
                )}
              </svg>

              {/* Live readout instead of a native <title> tooltip: it appears
                  instantly, is styled, and holds a stable spot so the layout
                  never shifts as the pointer crosses seats. */}
              <p
                className="mt-3 min-h-[2.75rem] max-w-xs text-center text-sm text-[var(--color-text-mid)]"
                aria-live="polite"
              >
                {hovered ? (
                  <>
                    <span className="font-semibold text-[var(--color-text-hi)]">
                      {constituencyLabel(hovered.constituency, state.state)}
                    </span>{" "}
                    — {hovered.name} ({hovered.party})
                  </>
                ) : (
                  <span className="text-[var(--color-text-low)]">
                    Point at a constituency to see who holds it.
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        {geo && (
          <ul className="mt-6 divide-y divide-[var(--color-ink-border)] overflow-hidden rounded-2xl border border-[var(--color-ink-border)]">
            {seats.map((f) => (
              <li key={f.properties.mpId}>
                <Link
                  to={`/mps/${f.properties.mpId}`}
                  onClick={onClose}
                  // Pointing at a row lifts the same seat on the map above, so
                  // the list and the shape are readable as one thing.
                  onMouseEnter={() => setHovered(f.properties)}
                  onFocus={() => setHovered(f.properties)}
                  className="flex items-center justify-between gap-4 bg-[var(--color-ink-raised)] px-4 py-3 transition-colors hover:bg-[var(--color-ink)]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: partyColor(f.properties.party) }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--color-text-hi)]">
                      {constituencyLabel(f.properties.constituency, state.state)}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-low)]">
                      {f.properties.name} · {f.properties.party}
                    </p>
                  </div>
                  {/* Allotted and the share spent, not just the leftover. The
                      geo files carry only `fundsUnspentCr`, so the rest is
                      looked up from the merged MP record by id rather than
                      duplicated into 36 boundary files. */}
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold text-[var(--color-text-hi)]">
                      {f.properties.fundsUnspentCr !== null
                        ? `₹${f.properties.fundsUnspentCr.toFixed(1)} Cr unspent`
                        : "—"}
                    </p>
                    {(() => {
                      const mp = getMPById(f.properties.mpId);
                      const pct = mp ? spentPctOfEntitlement(mp) : null;
                      if (!mp || mp.fundsEntitledCr === null) return null;
                      return (
                        <p className="tabular text-xs text-[var(--color-text-low)]">
                          of ₹{mp.fundsEntitledCr.toFixed(1)} Cr allotted
                          {pct !== null ? ` · ${pct}% spent` : ""}
                        </p>
                      );
                    })()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
