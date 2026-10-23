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
      <pre className="mt-3 overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs text-sky-100">
        {res ? res.sql : "Run the query to see the exact SQL that Spark executed."}
      </pre>
      <button
        onClick={run}
        disabled={busy || blocked}
        className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
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
    </div>
  );
}
