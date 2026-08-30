import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MPS, utilizationPct, type Grade } from "../data/mps";
import { GradeBadge } from "../components/GradeBadge";

const GRADES: Grade[] = ["A", "B", "C", "D", "F", "N/A"];

export function MPList() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [gradeFilter, setGradeFilter] = useState<Grade | "all">("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MPS.filter((mp) => {
      const matchesQuery =
        !q ||
        mp.name.toLowerCase().includes(q) ||
        mp.constituency.toLowerCase().includes(q) ||
        mp.state.toLowerCase().includes(q) ||
        mp.party.toLowerCase().includes(q);
      const matchesGrade = gradeFilter === "all" || mp.grade === gradeFilter;
      return matchesQuery && matchesGrade;
    }).sort((a, b) => (b.fundsUnspentCr ?? -1) - (a.fundsUnspentCr ?? -1));
  }, [query, gradeFilter]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-3xl font-bold text-[var(--color-text-hi)] sm:text-4xl">
        Browse MPs
      </h1>
      <p className="mt-2 text-[var(--color-text-mid)]">
        {MPS.length} tracked records. Search by name, constituency, state, or party.
      </p>

      <div
        className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--color-ink-border)] bg-[var(--color-ink-raised)] px-4 py-3.5 focus-within:border-[var(--color-accent)]"
      >
        <span className="text-sm font-semibold text-[var(--color-text-low)]">Find</span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setParams(e.target.value ? { q: e.target.value } : {});
          }}
          placeholder="e.g. Coimbatore, Kerala, Ravi Menon"
          className="flex-1 bg-transparent text-[15px] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-low)] focus:outline-none"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by grade">
        <button
          type="button"
          onClick={() => setGradeFilter("all")}
          className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
          style={
            gradeFilter === "all"
              ? { background: "var(--color-accent)", color: "white" }
              : { background: "var(--color-ink-raised)", color: "var(--color-text-mid)" }
          }
        >
          All grades
        </button>
        {GRADES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGradeFilter(g)}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
            style={
              gradeFilter === g
                ? { background: "var(--color-accent)", color: "white" }
                : { background: "var(--color-ink-raised)", color: "var(--color-text-mid)" }
            }
          >
            {g === "N/A" ? "Ungraded" : `Grade ${g}`}
          </button>
        ))}
      </div>

      <p className="mt-6 mb-3 text-xs font-semibold tracking-wide text-[var(--color-text-low)] uppercase">
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-ink-border)] px-6 py-14 text-center">
          <p className="font-semibold text-[var(--color-text-hi)]">No MPs match that search</p>
          <p className="mt-1.5 text-sm text-[var(--color-text-mid)]">
            Try a different constituency, state, or party name.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-ink-border)] overflow-hidden rounded-2xl border border-[var(--color-ink-border)]">
          {results.map((mp) => (
            <li key={mp.id}>
              <Link
                to={`/mps/${mp.id}`}
                className="flex items-center gap-4 bg-[var(--color-ink-raised)] px-4 py-4 transition-colors hover:bg-[var(--color-ink-card)] sm:px-5"
              >
                <GradeBadge grade={mp.grade} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--color-text-hi)]">{mp.name}</p>
                  <p className="truncate text-sm text-[var(--color-text-mid)]">
                    {mp.constituency}, {mp.state} · {mp.party}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="tabular font-display text-base font-bold text-[var(--color-text-hi)]">
                    {utilizationPct(mp) !== null ? `${utilizationPct(mp)}%` : "—"}
                  </p>
                  <p className="text-xs text-[var(--color-text-low)]">funds used</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
