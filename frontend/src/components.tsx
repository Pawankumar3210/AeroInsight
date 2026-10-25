import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { ApiError, post } from "./api";

export function ChartBox({ children }: { children: ReactElement }) {
  return (
    <div className="h-64 text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

const TONES: Record<string, string> = {
  positive: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  negative: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  info: "bg-accent-500/15 text-accent-600 dark:text-accent-300",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function Badge({ tone, children, title }: { tone: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.info}`}>
      {children}
    </span>
  );
}

export function ScoreNotice({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/sentiment/score");
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Scoring failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-4 text-sm">
      <p>Sentiment has not been calculated for this dataset yet. Sentiment charts and filters need it.</p>
      <button
        onClick={run}
        disabled={busy}
        className="mt-3 rounded-lg bg-accent-600 px-4 py-2 font-medium text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {busy ? "Scoring reviews…" : "Score reviews with the transformer"}
      </button>
      {err && <p role="alert" className="mt-2 text-rose-500">{err}</p>}
    </div>
  );
}
