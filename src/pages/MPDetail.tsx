import { Link, useParams } from "react-router-dom";
import { getMPById, unspentCr, utilizationPct } from "../data/mps";
import { GradeBadge } from "../components/GradeBadge";
import { StatusPill } from "../components/StatusPill";

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function MPDetail() {
  const { id } = useParams<{ id: string }>();
  const mp = id ? getMPById(id) : undefined;

  if (!mp) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
        <p className="font-display text-2xl font-bold text-[var(--color-text-hi)]">MP not found</p>
        <p className="mt-2 text-[var(--color-text-mid)]">
          That record doesn't exist in this dataset.
        </p>
        <Link to="/mps" className="mt-6 inline-block text-sm font-semibold text-[var(--color-accent-strong)]">
          ← Back to all MPs
        </Link>
      </div>
    );
  }

  const util = utilizationPct(mp);
  const unspent = unspentCr(mp);
  const hasFunds = mp.fundsEntitledCr !== null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
      <Link to="/mps" className="text-sm font-semibold text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]">
        ← Back to all MPs
      </Link>

      {/* Identity header */}
      <div className="mt-5 flex items-start gap-4">
        <span
          className="tabular flex size-14 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold text-white"
          style={{ background: mp.partyColor }}
        >
          {mp.photoInitials}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-hi)] sm:text-3xl">
            {mp.name}
          </h1>
          <p className="mt-0.5 text-[var(--color-text-mid)]">
            {mp.constituency}, {mp.state} · {mp.party}
          </p>
          {mp.termsServed && (
            <p className="mt-0.5 text-xs text-[var(--color-text-low)]">
              Lok Sabha terms: {mp.termsServed}
            </p>
          )}
        </div>
        <GradeBadge grade={mp.grade} size="lg" />
      </div>
      <p className="mt-4 rounded-xl bg-[var(--color-ink-raised)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-mid)]">
        {mp.gradeNote}
      </p>

      {/* MPLADS ledger */}
      <section
        className="mt-8 rounded-3xl p-6 sm:p-7"
        style={{ background: "var(--color-ink-card)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-[var(--color-text-low)] uppercase">
            MPLADS fund ledger
          </p>
          {mp.fundsDataTerm && <StatusPill label={mp.fundsDataTerm} tone="warn" />}
        </div>

        {hasFunds ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-low)]">
              Figures are for the {mp.fundsDataTerm} — the most recent term with public MPLADS
              data, matched by constituency. For a re-elected MP this is their own record; for
              others it reflects their predecessor's.
            </p>
            <dl className="mt-4 divide-y divide-[var(--color-ink-border)]">
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-[var(--color-text-mid)]">Entitled</dt>
                <dd className="tabular font-display text-lg font-bold text-[var(--color-text-hi)]">
                  ₹{mp.fundsEntitledCr!.toFixed(2)} Cr
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-[var(--color-text-mid)]">Received from GoI</dt>
                <dd className="tabular font-display text-lg font-bold text-[var(--color-text-hi)]">
                  ₹{(mp.fundsReceivedCr ?? 0).toFixed(2)} Cr
                </dd>
              </div>
              {mp.fundsSpentCr !== null && (
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-[var(--color-text-mid)]">Spent</dt>
                  <dd className="tabular font-display text-lg font-bold text-[var(--color-good)]">
                    − ₹{mp.fundsSpentCr.toFixed(2)} Cr
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between py-3.5">
                <dt className="font-semibold text-[var(--color-text-hi)]">Unspent balance</dt>
                <dd className="tabular font-display text-2xl font-extrabold text-[var(--color-warn)]">
                  ₹{unspent.toFixed(2)} Cr
                </dd>
              </div>
            </dl>

            {util !== null && (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-ink-border)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, util)}%`, background: "var(--color-accent)" }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-low)]">
                  {util}% of released funds spent
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-mid)]">
            No MPLADS fund record matched this constituency in the most recent public dataset
            (17th Lok Sabha, 2019–2024).
          </p>
        )}
      </section>

      {/* Parliamentary performance */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-[var(--color-text-hi)]">
          Parliamentary record, 18th Lok Sabha
        </h2>
        {mp.attendancePct !== null ? (
          <dl className="mt-3 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-[var(--color-ink-border)] bg-[var(--color-ink-raised)] px-4 py-3.5">
              <dt className="text-xs font-semibold tracking-wide text-[var(--color-text-low)] uppercase">
                Attendance
              </dt>
              <dd className="tabular mt-1 font-display text-xl font-bold text-[var(--color-text-hi)]">
                {mp.attendancePct}%
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--color-ink-border)] bg-[var(--color-ink-raised)] px-4 py-3.5">
              <dt className="text-xs font-semibold tracking-wide text-[var(--color-text-low)] uppercase">
                Debates
              </dt>
              <dd className="tabular mt-1 font-display text-xl font-bold text-[var(--color-text-hi)]">
                {mp.debates}
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--color-ink-border)] bg-[var(--color-ink-raised)] px-4 py-3.5">
              <dt className="text-xs font-semibold tracking-wide text-[var(--color-text-low)] uppercase">
                Questions
              </dt>
              <dd className="tabular mt-1 font-display text-xl font-bold text-[var(--color-text-hi)]">
                {mp.questions}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-mid)]">
            No PRS Legislative Research record matched this constituency.
          </p>
        )}
        {mp.prsSourceUrl && (
          <a
            href={mp.prsSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-semibold text-[var(--color-accent-strong)]"
          >
            View source on PRS Legislative Research →
          </a>
        )}
      </section>

      {/* Affidavit / ADR */}
      <section className="mt-8 mb-4">
        <h2 className="font-display text-lg font-bold text-[var(--color-text-hi)]">
          Election affidavit (ADR/MyNeta)
        </h2>
        {mp.criminalCases !== null ? (
          <dl className="mt-3 divide-y divide-[var(--color-ink-border)] overflow-hidden rounded-2xl border border-[var(--color-ink-border)]">
            <div className="flex items-baseline justify-between bg-[var(--color-ink-raised)] px-4 py-3">
              <dt className="text-[var(--color-text-mid)]">Declared criminal cases</dt>
              <dd className="tabular font-semibold text-[var(--color-text-hi)]">
                {mp.criminalCases}
              </dd>
            </div>
            <div className="flex items-baseline justify-between bg-[var(--color-ink-raised)] px-4 py-3">
              <dt className="text-[var(--color-text-mid)]">Education</dt>
              <dd className="font-semibold text-[var(--color-text-hi)]">{mp.education ?? "—"}</dd>
            </div>
            {mp.totalAssetsRs !== null && (
              <div className="flex items-baseline justify-between bg-[var(--color-ink-raised)] px-4 py-3">
                <dt className="text-[var(--color-text-mid)]">Declared assets</dt>
                <dd className="tabular font-semibold text-[var(--color-text-hi)]">
                  {formatRupees(mp.totalAssetsRs)}
                </dd>
              </div>
            )}
            {mp.liabilitiesRs !== null && (
              <div className="flex items-baseline justify-between bg-[var(--color-ink-raised)] px-4 py-3">
                <dt className="text-[var(--color-text-mid)]">Declared liabilities</dt>
                <dd className="tabular font-semibold text-[var(--color-text-hi)]">
                  {formatRupees(mp.liabilitiesRs)}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-mid)]">
            No ADR/MyNeta affidavit matched this constituency.
          </p>
        )}
        {mp.mynetaSourceUrl && (
          <a
            href={mp.mynetaSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-semibold text-[var(--color-accent-strong)]"
          >
            View affidavit on MyNeta →
          </a>
        )}
      </section>
    </div>
  );
}
