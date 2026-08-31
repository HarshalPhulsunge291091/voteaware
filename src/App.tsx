import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { NavBar } from "./components/NavBar";

const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const MPList = lazy(() => import("./pages/MPList").then((m) => ({ default: m.MPList })));
const MPDetail = lazy(() => import("./pages/MPDetail").then((m) => ({ default: m.MPDetail })));

function App() {
  // The landing page carries its own full-size wordmark and search, so the
  // compact top bar only repeated it above the hero. Interior pages keep it —
  // there it's the only way back and the only "Browse MPs" link.
  const isLanding = useLocation().pathname === "/";

  return (
    <div className="flex min-h-svh flex-col">
      {!isLanding && <NavBar />}
      <main className="flex-1">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mps" element={<MPList />} />
            <Route path="/mps/:id" element={<MPDetail />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-[var(--color-ink-border)] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-[var(--color-text-low)] sm:flex-row sm:items-center sm:justify-between">
          <p>VoteAware grades performance and public spending records — never party or ideology.</p>
          <p>
            Sourced from sansad.in, PRS, MyNeta/ADR and MPLADS records. Fund figures are 17th Lok
            Sabha (2019–2024).
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
