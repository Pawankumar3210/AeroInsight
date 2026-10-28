import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";

export interface HeroRoute { name: string; rating: number | null }

const HUB = { x: 392, y: 226 };
const ROUTES = [
  { d: "M 392 226 Q 560 14 928 64", end: [928, 64] },
  { d: "M 392 226 Q 650 126 958 176", end: [958, 176] },
  { d: "M 392 226 Q 610 296 872 258", end: [872, 258] },
  { d: "M 392 226 Q 470 56 702 42", end: [702, 42] },
] as const;
const PLANE = "M12 0 L-8 -6.5 L-4 0 L-8 6.5 Z";
const STARS: [number, number, number][] = [[470, 40, 0.2], [560, 120, 1.4], [640, 28, 2.1], [760, 96, 0.8], [820, 214, 2.6], [610, 270, 1.1], [930, 128, 1.9], [500, 160, 3], [710, 168, 0.4], [880, 30, 2.3], [440, 262, 1.7], [990, 250, 0.9]];

const routeColor = (r: number | null) => (r == null ? "#8B98B3" : r >= 7 ? "#34D399" : r >= 5 ? "#FFB02E" : "#FF6B81");

export default function Hero({
  headline, sub, chip, routes, action,
}: { headline: ReactNode; sub: string; chip: string; routes: HeroRoute[]; action?: ReactNode }) {
  const [still] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const shown = routes.slice(0, ROUTES.length);
  const move = (e: MouseEvent<HTMLElement>) => {
    if (still) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--px", x.toFixed(3));
    e.currentTarget.style.setProperty("--py", y.toFixed(3));
  };

  return (
    <section onMouseMove={move} className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#070C1B] text-white">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(820px 300px at 88% 118%, rgba(255,176,46,.30), transparent 62%), radial-gradient(640px 320px at 6% -30%, rgba(79,227,193,.20), transparent 62%), radial-gradient(500px 260px at 60% 0%, rgba(99,102,241,.22), transparent 70%)",
        }}
      />
      <svg
        aria-hidden
        viewBox="0 0 1000 300"
        preserveAspectRatio="xMaxYMid meet"
        className="absolute inset-y-0 right-0 -z-10 h-full w-full opacity-20 transition-transform duration-300 ease-out sm:opacity-100"
        style={{ transform: "translate(calc(var(--px, 0) * -14px), calc(var(--py, 0) * -8px))" }}
      >
        <defs>
          <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.1" fill="#fff" opacity=".16" />
          </pattern>
          <linearGradient id="fadeX" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".42" stopColor="#fff" stopOpacity=".9" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <radialGradient id="sweep" cx="392" cy="226" r="130" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4FE3C1" stopOpacity=".5" />
            <stop offset="1" stopColor="#4FE3C1" stopOpacity="0" />
          </radialGradient>
          <mask id="dotMask"><rect width="1000" height="300" fill="url(#fadeX)" /></mask>
          {shown.map((r, i) => (
            <linearGradient key={i} id={`rt${i}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={routeColor(r.rating)} stopOpacity="0" />
              <stop offset=".5" stopColor={routeColor(r.rating)} stopOpacity=".7" />
              <stop offset="1" stopColor={routeColor(r.rating)} />
            </linearGradient>
          ))}
        </defs>

        <rect width="1000" height="300" fill="url(#dots)" mask="url(#dotMask)" />
        {STARS.map(([x, y, d], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" className={still ? "" : "twinkle"} style={still ? { opacity: 0.35 } : { animationDelay: `${d}s` }} />
        ))}
        <circle cx={HUB.x} cy={HUB.y} r="130" fill="none" stroke="#4FE3C1" strokeOpacity=".16" strokeDasharray="2 5" />
        <g className={still ? "" : "spin-slow"} style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}>
          <path d="M392 226 L392 96 A130 130 0 0 1 484 134 Z" fill="url(#sweep)" />
        </g>
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="640" cy="330" rx={230 + i * 140} ry={150 + i * 76} fill="none" stroke="#fff" strokeOpacity=".07" />
        ))}

        {shown.map((r, i) => {
          const delay = 0.25 + i * 0.45;
          const [ex, ey] = ROUTES[i].end;
          const color = routeColor(r.rating);
          const label = `${r.name}${r.rating != null ? "  " + r.rating.toFixed(1) : ""}`;
          const w = Math.max(70, label.length * 7.2 + 22);
          return (
            <g key={r.name}>
              <path
                id={`route${i}`}
                d={ROUTES[i].d}
                pathLength={1}
                fill="none"
                stroke={`url(#rt${i})`}
                strokeWidth="2"
                strokeLinecap="round"
                className={still ? "" : "route-draw"}
                style={still ? undefined : { animationDelay: `${delay}s` }}
              />
              <circle cx={ex} cy={ey} r="4" fill={color} />
              {!still && (
                <circle cx={ex} cy={ey} r="4" fill="none" stroke={color} strokeWidth="1.5">
                  <animate attributeName="r" values="4;16;4" dur="3s" begin={`${delay + 3.2}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values=".8;0;.8" dur="3s" begin={`${delay + 3.2}s`} repeatCount="indefinite" />
                </circle>
              )}
              <g transform={`translate(${ex - w - 12} ${ey - 11})`}>
                <rect width={w} height="22" rx="11" fill="#0B1226" fillOpacity=".85" stroke={color} strokeOpacity=".5" />
                <text x={w / 2} y="15" textAnchor="middle" fontSize="11" fontWeight="600" fill="#E8ECF6" className="font-sans">{label}</text>
              </g>
              {still ? (
                <g transform={`translate(${ex} ${ey})`}><path d={PLANE} fill="#fff" /></g>
              ) : (
                <g>
                  <path d={PLANE} fill="#fff" />
                  <animateMotion dur="3.2s" begin={`${delay}s`} fill="freeze" rotate="auto" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1">
                    <mpath href={`#route${i}`} />
                  </animateMotion>
                </g>
              )}
            </g>
          );
        })}
        <circle cx={HUB.x} cy={HUB.y} r="5" fill="#4FE3C1" />
        <circle cx={HUB.x} cy={HUB.y} r="12" fill="none" stroke="#4FE3C1" strokeOpacity=".4" />
      </svg>

      <div className="relative max-w-[30rem] px-6 py-9 sm:px-10 sm:py-12">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          {chip}
        </p>
        <h2 className="font-display text-[2rem] font-semibold leading-[1.15] sm:text-[2.35rem]">{headline}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{sub}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </section>
  );
}
