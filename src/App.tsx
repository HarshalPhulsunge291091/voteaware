import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { Home } from "./pages/Home";
import { MPList } from "./pages/MPList";
import { MPDetail } from "./pages/MPDetail";

function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mps" element={<MPList />} />
          <Route path="/mps/:id" element={<MPDetail />} />
        </Routes>
      </main>
      <footer className="border-t border-[var(--color-ink-border)] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-[var(--color-text-low)] sm:flex-row sm:items-center sm:justify-between">
          <p>VoteAware grades performance and public spending records — never party or ideology.</p>
          <p>Preview data is illustrative, not a real record of any MP.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
