import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MPS, unspentCr, utilizationPct } from "../data/mps";
import { GradeBadge } from "../components/GradeBadge";
import { IndiaMap, type StateProperties } from "../components/IndiaMap";
import { StatePanel } from "../components/StatePanel";
import { useCountUp } from "../hooks/useCountUp";

const WITH_FUNDS = MPS.filter((mp) => mp.fundsUnspentCr !== null);
const TOTAL_UNSPENT = WITH_FUNDS.reduce((sum, mp) => sum + unspentCr(mp), 0);
const TOTAL_ENTITLED = WITH_FUNDS.reduce((sum, mp) => sum + (mp.fundsEntitledCr ?? 0), 0);
const FEATURED = [...WITH_FUNDS].sort((a, b) => unspentCr(b) - unspentCr(a)).slice(0, 5);

export function Home() {
  const [query, setQuery] = useState("");
  const [selectedState, setSelectedState] = useState<StateProperties | null>(null);
  const navigate = useNavigate();
  const tallied = useCountUp(TOTAL_UNSPENT);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(query.trim() ? `/mps?q=${encodeURIComponent(query.trim())}` : "/mps");
  }

  return (
    <div>
      {/* Hero: balance-style ledger */}
      <section className="border-b border-[var(--color-ink-border)] px-5 pt-14 pb-10 sm:px-8 sm:pt-20 sm:pb-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mx-auto max-w-3xl text-balance font-display text-[2.15rem] leading-[1.08] font-bold tracking-tight text-[var(--color-text-hi)] sm:text-6xl">
            Your MP's public money, checked like your own.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-[var(--color-text-mid)] sm:text-lg">
            VoteAware reads MPLADS fund records the way a payment app reads your transaction
            history — allotted, spent, and what's still sitting unused. No spin, just the ledger.
          </p>
        </div>

        {/* Aggregate balance card */}
        <div
          className="mx-auto mt-10 max-w-md rounded-3xl p-7 text-center sm:p-8"
          style={{ background: "var(--color-ink-card)", boxShadow: "var(--shadow-raised)" }}
        >
          <p className="text-xs font-semibold tracking-wide text-[var(--color-text-low)] uppercase">
            Unspent, across {WITH_FUNDS.length} MPs with matched MPLADS records
          </p>
          <p className="tabular mt-3 font-display text-5xl font-extrabold text-[var(--color-text-hi)] sm:text-6xl">
            ₹{tallied.toFixed(1)}
            <span className="text-2xl font-bold text-[var(--color-text-mid)] sm:text-3xl"> Cr</span>
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-mid)]">
            out of ₹{TOTAL_ENTITLED.toFixed(0)} Cr entitled — released, and still waiting to become
            a road, a clinic, a classroom.
          </p>
        </div>

        {/* Pay-to style search */}
        <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-lg">
          <label htmlFor="mp-search" className="sr-only">
            Search by MP, constituency, or state
          </label>
          <div
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-border)] bg-[var(--color-ink-raised)] px-4 py-3.5 focus-within:border-[var(--color-accent)]"
          >
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
      </section>

      {/* National map: state colored by leading party, click to drill in */}
      <section className="border-b border-[var(--color-ink-border)] px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-xl font-bold text-[var(--color-text-hi)]">
            Every state, by who's leading it
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--color-text-mid)]">
            Shaded by the party holding the most Lok Sabha seats in that state. Click a state to
            see its constituencies and unspent MPLADS funds.
          </p>
          <div className="mt-8">
            <IndiaMap onSelectState={setSelectedState} selectedSlug={selectedState?.slug ?? null} />
          </div>
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
              const util = utilizationPct(mp);
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
                        {mp.constituency}, {mp.state}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular font-display text-base font-bold text-[var(--color-warn)]">
                        ₹{unspentCr(mp).toFixed(1)} Cr
                      </p>
                      <p className="text-xs text-[var(--color-text-low)]">
                        unspent{util !== null ? ` · ${util}% used` : ""}
                      </p>
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
