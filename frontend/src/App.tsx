import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Command, Database, Info, LayoutDashboard, Menu, MessageSquareText, Moon, Search, Sparkles, Sun,
} from "lucide-react";
import { Brand } from "./Logo";
import Palette from "./Palette";
import type { PaletteAction } from "./Palette";
import { useDataset } from "./context";
import { cx } from "./lib";
import About from "./pages/About";
import Analyzer from "./pages/Analyzer";
import Compare from "./pages/Compare";
import Explorer from "./pages/Explorer";
import Insights from "./pages/Insights";
import Overview from "./pages/Overview";
import { useTheme } from "./theme";

const PAGES = [
  { to: "/", label: "Overview", sub: "Passenger sentiment at a glance", Icon: LayoutDashboard, group: "Analyze" },
  { to: "/compare", label: "Airline Comparison", sub: "Who passengers rate highest, and what they complain about", Icon: BarChart3, group: "Analyze" },
  { to: "/explorer", label: "Review Explorer", sub: "Search, filter and read the individual reviews", Icon: Search, group: "Analyze" },
  { to: "/analyzer", label: "Live Sentiment Analyzer", sub: "Paste any review and see how the model reads it", Icon: MessageSquareText, group: "Tools" },
  { to: "/spark", label: "Spark SQL Insights", sub: "The real queries behind every number", Icon: Database, group: "Tools" },
  { to: "/about", label: "About Project", sub: "How it works, what it can and cannot tell you", Icon: Info, group: "Project" },
];
const GROUPS = ["Analyze", "Tools", "Project"];

function ScrollLine() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={bar} aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-accent via-[#8B9BFF] to-[#FFB02E]" />;
}

function DatasetCard() {
  const { ds, demo } = useDataset();
  if (!ds) return <div className="skeleton h-24 rounded-xl" aria-hidden />;
  const name = ds.source.startsWith("Demo") ? "Demo dataset" : ds.source.replace("Uploaded file: ", "");
  const scored = ds.sentiment;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="relative flex h-2 w-2" aria-hidden><span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", demo ? "bg-amber-400" : "bg-emerald-400")} /><span className={cx("relative inline-flex h-2 w-2 rounded-full", demo ? "bg-amber-400" : "bg-emerald-400")} /></span>
        {demo ? "Saved snapshot" : "Live backend"}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-white" title={ds.source}>{name}</p>
      <p className="mt-0.5 text-xs text-slate-400">{ds.cleaning_report.rows_kept.toLocaleString("en-US")} reviews after cleaning</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-300">
        <Sparkles size={12} aria-hidden className={scored ? "text-emerald-300" : "text-slate-500"} />
        {scored ? (scored.method === "transformer" ? "Read by transformer" : "Word-list fallback") : "Not scored yet"}
      </p>
    </div>
  );
}

export default function App() {
  const { dark, toggle } = useTheme();
  const { ds, demo, scoring, score } = useDataset();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const page = PAGES.find((p) => p.to === pathname) ?? PAGES[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = PAGES.map((p) => ({
      id: p.to, label: p.label, hint: "Go to page", Icon: p.Icon, run: () => navigate(p.to),
    }));
    list.push({ id: "theme", label: dark ? "Switch to light theme" : "Switch to dark theme", hint: "Appearance", Icon: dark ? Sun : Moon, run: toggle });
    if (ds && !ds.sentiment && !demo && !scoring) {
      list.push({ id: "score", label: "Score reviews with the transformer", hint: "Action", Icon: Sparkles, run: () => { void score(); } });
    }
    return list;
  }, [navigate, dark, toggle, ds, demo, scoring, score]);

  return (
    <div className="min-h-screen lg:flex">
      <div aria-hidden className="aurora"><i /><i /><i /></div>
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-[17rem] transform flex-col border-r border-white/5 bg-[#080D1B] p-4 text-slate-200 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 px-2 pt-2"><Brand size={40} tone="light" /></div>

        <nav aria-label="Main" className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1.5 px-3 text-[11px] font-medium text-slate-500">{g}</p>
              <div className="space-y-0.5">
                {PAGES.filter((p) => p.group === g).map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        isActive ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#4FE3C1]" />}
                        <Icon size={17} aria-hidden className={cx("nav-icon", isActive && "text-[#4FE3C1]")} />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6"><DatasetCard /></div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[3.75rem] items-center justify-between gap-3 border-b border-line bg-canvas/70 px-4 backdrop-blur-xl sm:px-6">
          <ScrollLine />
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-line p-2 text-muted hover:bg-raised lg:hidden"
            >
              <Menu size={16} aria-hidden />
            </button>
            <Brand size={30} className="lg:hidden" />
            <div className="hidden min-w-0 lg:block">
              <h1 className="truncate font-display text-[15px] font-semibold leading-tight">{page.label}</h1>
              <p className="hidden truncate text-xs text-muted sm:block">{page.sub}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPalette(true)}
              className="hidden items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-muted transition hover:bg-raised sm:flex"
            >
              <Search size={13} aria-hidden /> Jump to…
              <kbd className="ml-3 inline-flex items-center gap-0.5 rounded border border-line bg-raised px-1.5 py-0.5 font-sans text-[10px]"><Command size={9} aria-hidden />K</kbd>
            </button>
            <button
              onClick={toggle}
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              className="rounded-lg border border-line bg-panel p-2 text-muted transition hover:bg-raised hover:text-ink"
            >
              {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            </button>
          </div>
        </header>

        {demo && (
          <div role="status" className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-xs leading-relaxed text-warn sm:px-6">
            <strong>Demo snapshot.</strong> The live backend is not connected, so these are results saved from real Spark SQL
            queries and transformer predictions run on {demo.replace("T", " ").slice(0, 16)} UTC. Nothing is being computed now;
            filters, scoring, the analyzer and uploads need the live backend.
          </div>
        )}

        <main key={pathname} className="page-enter mx-auto max-w-[1360px] p-4 sm:p-6">
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

      <Palette open={palette} onClose={() => setPalette(false)} actions={actions} />
    </div>
  );
}
