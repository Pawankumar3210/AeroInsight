import { useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, Database, Info, LayoutDashboard, Menu, MessageSquareText, Moon, Plane, Search, Sun } from "lucide-react";
import { useDemoMode } from "./api";
import About from "./pages/About";
import Analyzer from "./pages/Analyzer";
import Compare from "./pages/Compare";
import Explorer from "./pages/Explorer";
import Insights from "./pages/Insights";
import Overview from "./pages/Overview";
import { useTheme } from "./theme";

const NAV = [
  { to: "/", label: "Overview", Icon: LayoutDashboard },
  { to: "/compare", label: "Airline Comparison", Icon: BarChart3 },
  { to: "/explorer", label: "Review Explorer", Icon: Search },
  { to: "/analyzer", label: "Live Sentiment Analyzer", Icon: MessageSquareText },
  { to: "/spark", label: "Spark SQL Insights", Icon: Database },
  { to: "/about", label: "About Project", Icon: Info },
];

export default function App() {
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const demo = useDemoMode();
  const { pathname } = useLocation();
  const title = NAV.find((n) => n.to === pathname)?.label ?? "AeroInsight";

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 transform flex-col border-r border-white/5 bg-[#0A1020] p-4 text-slate-200 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center gap-3 px-2 pt-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-700">
            <Plane size={18} className="text-white" aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-white">AeroInsight</span>
        </div>
        <nav aria-label="Main" className="space-y-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden className="absolute bottom-2 left-0 top-2 w-0.5 rounded bg-accent-400" />}
                  <Icon size={17} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-3 pb-2 text-xs leading-relaxed text-slate-500">
          Spark SQL analytics with transformer sentiment.
        </p>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-[#F4F6FB]/80 px-4 backdrop-blur dark:border-white/[0.07] dark:bg-navy-950/80">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-slate-300 p-2 lg:hidden dark:border-white/15"
            >
              <Menu size={16} aria-hidden />
            </button>
            <h1 className="font-display text-base font-semibold text-slate-900 dark:text-white">{title}</h1>
          </div>
          <button
            onClick={toggle}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
          >
            {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
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
