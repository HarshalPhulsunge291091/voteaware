import { Link, useLocation } from "react-router-dom";

export function NavBar() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-ink-border)] bg-[var(--color-ink)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="tabular flex size-8 items-center justify-center rounded-lg font-display text-sm font-bold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            VA
          </span>
          <span className="font-display text-base font-bold tracking-tight text-[var(--color-text-hi)]">
            VoteAware
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-[var(--color-text-mid)]">
          <Link
            to="/mps"
            className={`transition-colors hover:text-[var(--color-text-hi)] ${!onHome ? "text-[var(--color-text-hi)]" : ""}`}
          >
            Browse MPs
          </Link>
          <a href="#method" className="hidden transition-colors hover:text-[var(--color-text-hi)] sm:inline">
            How grading works
          </a>
        </nav>
      </div>
    </header>
  );
}
