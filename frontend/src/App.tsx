import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useDemoMode } from "./api";
import About from "./pages/About";
import Analyzer from "./pages/Analyzer";
import Compare from "./pages/Compare";
import Explorer from "./pages/Explorer";
import Insights from "./pages/Insights";
import Overview from "./pages/Overview";
import { useTheme } from "./theme";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/compare", label: "Airline Comparison" },
  { to: "/explorer", label: "Review Explorer" },
  { to: "/analyzer", label: "Live Sentiment Analyzer" },
  { to: "/spark", label: "Spark SQL Insights" },
  { to: "/about", label: "About Project" },
];

export default function App() {
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const demo = useDemoMode();

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-gradient-to-b from-navy-900 to-navy-800 p-5 text-slate-200 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center gap-2">
          <span aria-hidden className="text-2xl text-sky-400">✈</span>
          <span className="text-lg font-semibold tracking-tight">AeroInsight</span>
        </div>
        <nav aria-label="Main" className="space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2 text-sm ${isActive ? "bg-sky-500/15 text-sky-300" : "hover:bg-white/5"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-navy-950/80">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm lg:hidden dark:border-white/20"
            >
              ☰
            </button>
            <p className="text-sm text-slate-500 dark:text-slate-400">Aviation Data Analytics · Spark SQL + NLP</p>
          </div>
          <button
            onClick={toggle}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-white/20"
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </header>
        {demo && (
          <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
            <strong>Demo snapshot.</strong> The live backend is not connected, so you are seeing results saved from
            real Spark SQL queries and transformer predictions run on {demo.replace("T", " ").slice(0, 16)} UTC. No
            query or model is running now. The analyzer, scoring and uploads need the live backend.
          </div>
        )}
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/analyzer" element={<Analyzer />} />
            <Route path="/spark" element={<Insights />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
