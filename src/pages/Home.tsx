import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MPS, unspentCr, spentPctOfEntitlement, constituencyLabel } from "../data/mps";
import { GradeBadge } from "../components/GradeBadge";
import { IndiaMap } from "../components/IndiaMap";
import { SeatSplitBar } from "../components/SeatSplitBar";
import { STATE_SUMMARIES, type StateProperties } from "../data/states";
import { seatSplit, summariseSplit, type SeatSplitEntry } from "../data/seat-split";
import { StatePanel } from "../components/StatePanel";
import { useCountUp } from "../hooks/useCountUp";

const WITH_FUNDS = MPS.filter((mp) => mp.fundsUnspentCr !== null);
const TOTAL_UNSPENT = WITH_FUNDS.reduce((sum, mp) => sum + unspentCr(mp), 0);
const TOTAL_ENTITLED = WITH_FUNDS.reduce((sum, mp) => sum + (mp.fundsEntitledCr ?? 0), 0);
const FEATURED = [...WITH_FUNDS].sort((a, b) => unspentCr(b) - unspentCr(a)).slice(0, 5);

const WORDMARK = "VoteAware";

// Every party that leads at least one state, so the map's colours are never
// the only thing carrying the identity. Ordered by states led, then by name so
// the tail is stable rather than dependent on feature order.
const LEGEND = [...
  STATE_SUMMARIES.reduce((acc, s) => {
    const entry = acc.get(s.leadingParty) ?? { party: s.leadingParty, color: s.leadingPartyColor, states: 0 };
    entry.states += 1;
    acc.set(s.leadingParty, entry);
    return acc;
  }, new Map<string, { party: string; color: string; states: number }>()).values(),
].sort((a, b) => b.states - a.states || a.party.localeCompare(b.party));

// Per-state Lok Sabha seat splits, built once from the merged MP records. The
// geo files carry only the leading party, and a plurality on its own
// misrepresents a state like Maharashtra, where the largest party holds 13 of
// 47 seats but the map paints it a single flat colour.
const SPLIT_BY_STATE = new Map<string, SeatSplitEntry[]>();
for (const mp of MPS) {
  const existing = SPLIT_BY_STATE.get(mp.state) ?? [];
  SPLIT_BY_STATE.set(mp.state, existing);
}
for (const state of [...SPLIT_BY_STATE.keys()]) {
  SPLIT_BY_STATE.set(state, seatSplit(MPS.filter((mp) => mp.state === state).map((mp) => mp.party)));
}

// Entrance choreography, in one place so the sequence stays readable: letters
// print, the rule draws under them, then the country resolves north to south,
// and only then do the controls settle in. Every value is a start time in ms.
const CUE = {
  letterStep: 45,
  rule: 430,
  tagline: 520,
  map: 620,
  readout: 700,
  search: 820,
};

export function Home() {
  const [query, setQuery] = useState("");
  const [selectedState, setSelectedState] = useState<StateProperties | null>(null);
  const [hoveredState, setHoveredState] = useState<StateProperties | null>(null);
  const hoveredSplit = hoveredState ? (SPLIT_BY_STATE.get(hoveredState.state) ?? []) : [];
  const navigate = useNavigate();
  const tallied = useCountUp(TOTAL_UNSPENT);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(query.trim() ? `/mps?q=${encodeURIComponent(query.trim())}` : "/mps");
  }

  return (
    <div>
      {/* Hero: wordmark, the country, and one live balance readout */}
      <section className="relative overflow-hidden border-b border-[var(--color-ink-border)] px-5 pt-16 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
        <div className="ledger-grid" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl">
          <h1
            className="text-center font-display leading-none font-extrabold tracking-[-0.04em] text-[var(--color-text-hi)]"
            style={{ fontSize: "var(--text-wordmark)" }}
            aria-label={WORDMARK}
          >
            <span aria-hidden="true">
              {WORDMARK.split("").map((letter, i) => (
                <span
                  key={`${letter}-${i}`}
                  className="wordmark-letter"
                  style={{ animationDelay: `${i * CUE.letterStep}ms` }}
                >
                  {letter}
                </span>
              ))}
            </span>
          </h1>

          <div
            className="wordmark-rule mx-auto mt-4 h-px w-40 sm:w-56"
            style={{
              animationDelay: `${CUE.rule}ms`,
              background:
                "linear-gradient(to right, transparent, var(--color-accent-strong), transparent)",
            }}
            aria-hidden="true"
          />

          <p
            className="settle-in mx-auto mt-5 max-w-xl text-center text-balance text-base leading-relaxed text-[var(--color-text-mid)] sm:text-lg"
            style={{ animationDelay: `${CUE.tagline}ms` }}
          >
            Your MP's public money, checked like your own. MPLADS records read the way a payment
            app reads your transaction history — allotted, spent, and what's still sitting unused.
          </p>

          {/* The map is the hero's centrepiece, with the balance card reading
              off it: national totals at rest, the pointed-at state's totals on
              hover. One number that answers wherever you're looking. */}
          <div className="mt-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
            <div
              // Sized so the whole country still clears a 900px-tall viewport:
              // the map is 480x520, so anything wider than ~lg starts cutting
              // the southern tip off below the fold.
              className="settle-in mx-auto w-full max-w-lg lg:justify-self-center"
              style={{ animationDelay: `${CUE.map}ms` }}
            >
              <IndiaMap
                onSelectState={setSelectedState}
                onHoverState={setHoveredState}
                selectedSlug={selectedState?.slug ?? null}
                startDelayMs={CUE.map}
              />
            </div>

            <div
              className="settle-in mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none"
              style={{ animationDelay: `${CUE.readout}ms` }}
            >
              <div
                className="rounded-3xl p-6 sm:p-7"
                style={{ background: "var(--color-ink-card)", boxShadow: "var(--shadow-raised)" }}
              >
                <dl>
                  <dt className="text-xs font-semibold tracking-wide text-[var(--color-text-low)] uppercase">
                    {hoveredState ? hoveredState.state : "Unspent nationally"}
                  </dt>
                  <dd className="tabular mt-3 font-display text-4xl font-extrabold text-[var(--color-text-hi)] sm:text-5xl">
                    ₹{(hoveredState ? hoveredState.totalUnspentCr : tallied).toFixed(1)}
                    <span className="text-xl font-bold text-[var(--color-text-mid)] sm:text-2xl">
                      {" "}
                      Cr
                    </span>
                  </dd>
                  {/* Fixed min-height: the two readouts run to different
                      lengths, and the map must not shift as you sweep it. */}
                  <dd className="mt-2 min-h-[7rem] text-sm leading-relaxed text-[var(--color-text-mid)]">
                    {hoveredState ? (
                      <>
                        left unspent across {hoveredState.seatsWithFundsData} of{" "}
                        {hoveredState.seatCount} Lok Sabha seats.
                        {/* The split, not just the largest party: shading a
                            state one colour makes a plurality look like a
                            sweep. */}
                        <span className="mt-3 block">
                          <SeatSplitBar split={hoveredSplit} />
                          <span className="tabular mt-2 block text-xs text-[var(--color-text-low)]">
                            {summariseSplit(hoveredSplit)}
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        out of ₹{TOTAL_ENTITLED.toFixed(0)} Cr entitled to {WITH_FUNDS.length} MPs
                        with matched MPLADS records — released, and still waiting to become a road,
                        a clinic, a classroom.
                      </>
                    )}
                  </dd>
                </dl>

                <p className="mt-4 border-t border-[var(--color-ink-border)] pt-4 text-xs leading-relaxed text-[var(--color-text-low)]">
                  {hoveredState
                    ? `Select ${hoveredState.state} to see every constituency.`
                    : "Shaded by the party holding the most Lok Sabha seats — this is Parliament, not the state government. Those are separate elections and often different parties."}
                </p>
              </div>

              {/* Colour alone never carries the party — the legend names every
                  one that leads a state, and each seat is labelled again in
                  the state panel. */}
              {/* Padded to match the card's own inner padding above, so the
                  legend's first column lines up with the card's text rather
                  than with its outer edge. */}
              <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 px-6 sm:px-7 lg:justify-start">
                {LEGEND.map((entry) => (
                  <li
                    key={entry.party}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-text-mid)]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: entry.color }}
                    />
                    {entry.party}
                    <span className="tabular text-[var(--color-text-low)]">{entry.states}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pay-to style search */}
          <form
            onSubmit={handleSearch}
            className="settle-in mx-auto mt-10 max-w-lg"
            style={{ animationDelay: `${CUE.search}ms` }}
          >
            <label htmlFor="mp-search" className="sr-only">
              Search by MP, constituency, or state
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-border)] bg-[var(--color-ink-raised)] px-4 py-3.5 focus-within:border-[var(--color-accent)]">
              <span className="text-sm font-semibold text-[var(--color-text-low)]">Find</span>
              <input
                id="mp-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="MP, constituency, or state"
                className="w-0 flex-1 bg-transparent text-[15px] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-low)] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
                style={{ background: "var(--color-accent)" }}
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {selectedState && <StatePanel state={selectedState} onClose={() => setSelectedState(null)} />}

      {/* Receipt-style MP feed */}
      <section className="border-b border-[var(--color-ink-border)] px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold text-[var(--color-text-hi)]">
              Most left unspent
            </h2>
            <Link to="/mps" className="text-sm font-semibold text-[var(--color-accent-strong)]">
              View all {MPS.length} MPs →
            </Link>
          </div>

          <ul className="divide-y divide-[var(--color-ink-border)] overflow-hidden rounded-2xl border border-[var(--color-ink-border)]">
            {FEATURED.map((mp) => {
              const spentPct = spentPctOfEntitlement(mp);
              return (
                <li key={mp.id}>
                  <Link
                    to={`/mps/${mp.id}`}
                    className="flex items-center gap-4 bg-[var(--color-ink-raised)] px-4 py-4 transition-colors hover:bg-[var(--color-ink-card)] sm:px-5"
                  >
                    <GradeBadge grade={mp.grade} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[var(--color-text-hi)]">{mp.name}</p>
                      <p className="truncate text-sm text-[var(--color-text-mid)]">
                        {constituencyLabel(mp.constituency, mp.state)}, {mp.state}
                      </p>
                    </div>
                    {/* Allotted alongside spent, and the share between them —
                        an unspent figure on its own means nothing without the
                        size of the pot it came out of. */}
                    <div className="shrink-0 text-right">
                      <p className="tabular font-display text-base font-bold text-[var(--color-warn)]">
                        ₹{unspentCr(mp).toFixed(1)} Cr
                      </p>
                      <p className="tabular text-xs text-[var(--color-text-low)]">
                        unspent
                        {mp.fundsEntitledCr !== null
                          ? ` · ₹${mp.fundsEntitledCr.toFixed(1)} Cr allotted`
                          : ""}
                      </p>
                      {spentPct !== null && (
                        <p className="tabular text-xs font-semibold text-[var(--color-text-mid)]">
                          {spentPct}% of it spent
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-[var(--color-text-low)]">
            MPLADS fund figures above are from the 17th Lok Sabha (2019–2024), the most recent term
            with publicly available data — see an MP's page for the exact term and source.
          </p>
        </div>
      </section>

      {/* Method / trust strip — itemized like the fund ledger above */}
      <section id="method" className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-[var(--color-text-hi)] sm:text-3xl">
            How a grade gets calculated
          </h2>
          <p className="mt-2 text-[var(--color-text-mid)]">
            Two public signals, averaged into one letter — the same way every MP's ledger above is
            built. An MP with neither signal matched gets no grade rather than a guessed one.
          </p>

          <dl className="mt-7 divide-y divide-[var(--color-ink-border)] overflow-hidden rounded-2xl border border-[var(--color-ink-border)]">
            <div className="bg-[var(--color-ink-raised)] px-5 py-4">
              <dt className="font-semibold text-[var(--color-text-hi)]">Fund utilization</dt>
              <dd className="mt-1 text-sm leading-relaxed text-[var(--color-text-mid)]">
                What share of released MPLADS funds actually got spent, sourced from the most
                recent public dataset (17th Lok Sabha, 2019–2024).
              </dd>
            </div>
            <div className="bg-[var(--color-ink-raised)] px-5 py-4">
              <dt className="font-semibold text-[var(--color-text-hi)]">Sitting attendance</dt>
              <dd className="mt-1 text-sm leading-relaxed text-[var(--color-text-mid)]">
                Share of Lok Sabha sittings the MP attended this (18th) term, from PRS Legislative
                Research's tracker.
              </dd>
            </div>
          </dl>

          <p className="mt-8 text-sm leading-relaxed text-[var(--color-text-low)]">
            VoteAware grades performance and spending records, never party or ideology. Every
            figure links back to its public source: sansad.in, PRS Legislative Research,
            MyNeta/ADR, and MPLADS fund data mirrored via data.opencity.in.
          </p>
        </div>
      </section>
    </div>
  );
}
