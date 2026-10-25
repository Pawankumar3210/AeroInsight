import { useCallback, useEffect, useState } from "react";
import { ApiError, get } from "../api";
import type { Dataset, QueryResult } from "../api";
import { Badge, ScoreNotice } from "../components";
import { Card } from "../ui";

interface Meta { name: string; purpose: string; needs_sentiment: boolean }

const USE: Record<string, string> = {
  reviews_by_airline: "Shows how much feedback each airline has. Small counts mean conclusions about that airline are weaker.",
  avg_rating_by_airline: "A quick benchmark of overall satisfaction. Compare airlines, and track your own over time.",
  rating_distribution: "Reveals whether opinions are consistent or split between very happy and very unhappy passengers.",
  monthly_review_trend: "Helps spot seasonal dips, or recovery after a service change.",
  complaint_categories: "Suggests which operational area (delays, baggage, service, seating…) to investigate first.",
  low_rating_share_by_airline: "Highlights airlines where a large share of passengers were unhappy, ignoring airlines with too few reviews.",
  sentiment_counts: "The overall mood of the feedback in one view.",
  sentiment_vs_rating: "Where the text and the star rating disagree, look closer: it may be a mixed review or a model mistake.",
  negative_trend_monthly: "Shows whether complaints are rising or falling month to month.",
  negative_share_by_airline: "Ranks airlines by how often passengers write negatively, with a minimum sample size.",
};

function QueryCard({ meta, scored }: { meta: Meta; scored: boolean }) {
  const [res, setRes] = useState<QueryResult<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setRes(await get<QueryResult<Record<string, unknown>>>("/api/spark/" + meta.name));
    } catch (e) {
      setRes(null);
      setError(e instanceof ApiError ? e.message : "Query failed.");
    } finally {
      setBusy(false);
    }
  }

  const cols = res && res.rows.length ? Object.keys(res.rows[0]) : [];
  const blocked = meta.needs_sentiment && !scored;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-sm font-semibold">{meta.name}</h2>
        {meta.needs_sentiment && <Badge tone="info">needs sentiment</Badge>}
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{meta.purpose}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400"><strong>For management:</strong> {USE[meta.name] ?? "Supports data-driven service decisions."}</p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs text-accent-100">
        {res ? res.sql : "Run the query to see the exact SQL that Spark executed."}
      </pre>
      <button
        onClick={run}
        disabled={busy || blocked}
        className="mt-3 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
      >
        {busy ? "Running…" : blocked ? "Score reviews first" : "Run query"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-rose-500">{error}</p>}
      {res && (
        <div className="mt-3 overflow-x-auto">
          <p className="mb-1 text-xs text-slate-500">{res.row_count} result row(s) from Spark SQL</p>
          <table className="w-full">
            <thead>
              <tr>{cols.map((c) => <th key={c} className="px-3 py-1 text-left text-xs font-semibold text-slate-500">{c}</th>)}</tr>
            </thead>
            <tbody>
              {res.rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-200 dark:border-white/10">
                  {cols.map((c) => <td key={c} className="px-3 py-1 text-sm">{r[c] === null ? "—" : String(r[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface BenchResult {
  rows: number; file_mb: number; spark_median_s: number; pandas_median_s: number;
  spark_runs_s: number[]; pandas_runs_s: number[]; faster: string; speed_ratio: number; results_match: boolean;
}
interface BenchReport {
  run_at_utc: string; data: string; task: string; spark_sql: string;
  machine: Record<string, string | number>; methodology: string[]; results: BenchResult[];
}

function Benchmark() {
  const [rep, setRep] = useState<BenchReport | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<BenchReport>("/api/benchmark")
      .then(setRep)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
        else setError(e instanceof ApiError ? e.message : "Could not load the benchmark.");
      });
  }, []);

  if (error) return <Card title="Benchmark: Spark SQL vs pandas"><p role="alert" className="text-sm text-rose-500">{error}</p></Card>;
  if (missing) {
    return (
      <Card title="Benchmark: Spark SQL vs pandas">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No benchmark has been run yet. On the machine running the backend, run <code>python -m app.benchmark</code>.
        </p>
      </Card>
    );
  }
  if (!rep) return <Card title="Benchmark: Spark SQL vs pandas"><p aria-busy="true" className="text-sm text-slate-500">Loading…</p></Card>;

  const total = rep.results.length;
  const pandasWins = rep.results.filter((r) => r.faster === "pandas").length;
  const th = "px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400";
  const td = "px-3 py-2 text-sm";

  return (
    <Card title="Benchmark: Spark SQL vs pandas">
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone="warn">Synthetic data: timing only</Badge>
        <Badge tone="info">Measured {rep.run_at_utc.replace("T", " ")} UTC</Badge>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <strong>Task:</strong> {rep.task} <strong>Data:</strong> {rep.data}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>
              <th className={th}>Rows</th><th className={th}>File (MB)</th><th className={th}>Spark SQL (s)</th>
              <th className={th}>pandas (s)</th><th className={th}>Faster</th><th className={th}>By</th><th className={th}>Results match</th>
            </tr>
          </thead>
          <tbody>
            {rep.results.map((r) => (
              <tr key={r.rows} className="border-t border-slate-200 dark:border-white/10">
                <td className={td}>{r.rows.toLocaleString()}</td>
                <td className={td}>{r.file_mb}</td>
                <td className={td} title={`runs: ${r.spark_runs_s.join(", ")}`}>{r.spark_median_s}</td>
                <td className={td} title={`runs: ${r.pandas_runs_s.join(", ")}`}>{r.pandas_median_s}</td>
                <td className={`${td} font-medium`}>{r.faster === "spark" ? "Spark SQL" : "pandas"}</td>
                <td className={td}>{r.speed_ratio}×</td>
                <td className={td}>{r.results_match ? "yes" : "NO"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">Median of repeated runs. Hover a time to see every run.</p>

      <p className="mt-3 rounded-lg bg-accent-500/10 p-3 text-sm">
        <strong>Reading the result honestly:</strong> pandas was faster at {pandasWins} of {total} sizes tested. Spark has
        a fixed start-up cost per job, which dominates on small files. Spark is built for data too large for one
        machine, which this laptop test does not cover. These numbers do not show that Spark is faster.
      </p>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium">Methodology and machine</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
          {rep.methodology.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          {Object.entries(rep.machine).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs text-accent-100">{rep.spark_sql}</pre>
      </details>
    </Card>
  );
}

export default function Insights() {
  const [metas, setMetas] = useState<Meta[] | null>(null);
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, d] = await Promise.all([get<Meta[]>("/api/queries"), get<Dataset>("/api/dataset")]);
      setMetas(m);
      setDs(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the query list.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <Card><p role="alert" className="text-rose-500">{error}</p></Card>;
  if (!metas || !ds) return <p aria-busy="true" className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Spark SQL insights</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Every result below is produced by a real Spark SQL query run on the backend against the “reviews” view.
        Press <em>Run query</em> to execute it and see the exact SQL and its output. Dataset: {ds.source}
      </p>
      {!ds.sentiment && <ScoreNotice onDone={load} />}
      {metas.map((m) => <QueryCard key={m.name} meta={m} scored={!!ds.sentiment} />)}
      <Benchmark />
    </div>
  );
}
