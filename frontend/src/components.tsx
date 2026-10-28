import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { Loader2, Sparkles } from "lucide-react";
import { useDataset } from "./context";
import { Button } from "./ui";

export function ChartBox({ children, height = 260 }: { children: ReactElement; height?: number }) {
  return (
    <div className="text-faint" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

interface TipItem { name?: string | number; value?: number | string; color?: string; dataKey?: string | number }
/** Themed tooltip for Recharts. */
export function ChartTip({
  active, payload, label, suffix = "", labelFormatter,
}: {
  active?: boolean; payload?: TipItem[]; label?: string | number; suffix?: string; labelFormatter?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const head = label !== undefined ? (labelFormatter ? labelFormatter(label) : String(label)) : null;
  return (
    <div className="min-w-[130px] rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-xl">
      {head && <p className="mb-1 font-display font-semibold text-ink">{head}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center justify-between gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium text-ink">{typeof p.value === "number" ? p.value.toLocaleString("en-US") : p.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
}

export const axisProps = {
  tick: { fill: "currentColor", fontSize: 11 },
  stroke: "currentColor",
  strokeOpacity: 0.25,
  tickLine: false,
} as const;

/** Tiny inline trend line for KPI cells. */
export function Sparkline({ values, color = "#4FE3C1" }: { values: number[]; color?: string }) {
  const w = 96;
  const h = 28;
  if (values.length < 2) return <div className="h-7 w-24 border-b border-dashed border-line" aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const id = `sp${color.replace("#", "")}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} pathLength={1} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="spark-draw" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Number that eases up to its value. */
export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const current = useRef(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) { current.current = value; setShown(value); return; }
    const from = current.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = from + (value - from) * eased;
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toFixed(decimals)}{suffix}</>;
}

/** Shown on any page that needs sentiment scores which do not exist yet. */
export function ScoreBanner({ compact = false }: { compact?: boolean }) {
  const { ds, scoring, score, scoreError, demo } = useDataset();
  if (!ds || ds.sentiment) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent"><Sparkles size={16} aria-hidden /></span>
        <div>
          <p className="text-sm font-semibold">Sentiment has not been calculated yet</p>
          {!compact && (
            <p className="mt-0.5 max-w-xl text-sm text-muted">
              {demo
                ? "This snapshot was saved before scoring. Scoring needs the live backend."
                : "The transformer reads every review. The first run downloads the model (about 500 MB) and can take several minutes; later runs take seconds."}
            </p>
          )}
          {scoreError && <p role="alert" className="mt-1 text-sm text-neg">{scoreError}</p>}
        </div>
      </div>
      <Button variant="primary" onClick={score} disabled={scoring || !!demo}>
        {scoring ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Scoring…</> : "Score reviews"}
      </Button>
    </div>
  );
}
