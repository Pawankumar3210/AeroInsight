import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Cpu, Database, FileSpreadsheet, Filter, Globe, Loader2, Play, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError, get } from "../api";
import type { Dataset, QueryResult } from "../api";
import { ChartBox, ChartTip, ScoreBanner, axisProps } from "../components";
import { useDataset } from "../context";
import { cx, fmtNum, plural } from "../lib";
import { SqlBlock } from "../sql";
import { Button, EmptyState, ErrorState, Panel, Pill, Rise, Skeleton } from "../ui";

interface Meta { name: string; purpose: string; needs_sentiment: boolean }

const USE: Record<string, string> = {
  reviews_by_airline: "Shows how much feedback each airline has. Small counts mean conclusions about that airline are weaker.",
  avg_rating_by_airline: "A quick benchmark of overall satisfaction. Compare airlines, and track your own over time.",
  rating_distribution: "Reveals whether opinions are consistent or split between very happy and very unhappy passengers.",
  monthly_review_trend: "Helps spot seasonal dips, or recovery after a service change.",
  complaint_categories: "Suggests which operational area (delays, baggage, service, seating…) to investigate first.",
  complaints_by_airline: "Shows where each airline's complaints concentrate, so teams can target the right process.",
  low_rating_share_by_airline: "Highlights airlines where a large share of passengers were unhappy, ignoring airlines with too few reviews.",
  sentiment_counts: "The overall mood of the feedback in one view.",
  sentiment_vs_rating: "Where the text and the star rating disagree, look closer: it may be a mixed review or a model mistake.",
  negative_trend_monthly: "Shows whether complaints are rising or falling month to month.",
  negative_share_by_airline: "Ranks airlines by how often passengers write negatively, with a minimum sample size.",
};

function Step({ Icon, title, detail, last }: { Icon: LucideIcon; title: string; detail: string; last?: boolean }) {
  return (
    <div className="flex items-center lg:flex-1">
      <div className="flex-1 rounded-xl border border-line bg-raised/60 p-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent"><Icon size={17} aria-hidden /></span>
        <p className="mt-3 font-display text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{detail}</p>
      </div>
      {!last && (
        <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden className="mx-1 hidden shrink-0 text-accent lg:block">
          <path d="M0 6 H28" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.6" className="flow-dash" fill="none" />
          <circle r="2.8" cy="0" fill="currentColor"><animateMotion dur="1.4s" repeatCount="indefinite" path="M0 6 H28" /></circle>
          <path d="M26 1.5 L32 6 L26 10.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function Pipeline({ ds, queryCount }: { ds: Dataset; queryCount: number }) {
  const c = ds.cleaning_report;
  return (
    <Panel title="How a number gets to the screen" subtitle="Real counts from the dataset that is loaded right now">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0">
        <Step Icon={FileSpreadsheet} title="CSV read" detail={`${fmtNum(c.rows_in)} rows`} />
        <Step Icon={Filter} title="Clean and validate" detail={`${plural(c.rows_removed, "row")} dropped, ${plural(c.invalid_ratings_nulled, "rating")} ignored`} />
        <Step Icon={Database} title="Spark view “reviews”" detail={`${fmtNum(c.rows_kept)} rows cached in memory`} />
        <Step Icon={Sparkles} title="Transformer scores" detail={ds.sentiment ? `${fmtNum(ds.sentiment.scored_rows)} rows scored` : "Waiting to be scored"} />
        <Step Icon={Cpu} title="Spark SQL" detail={`${queryCount} named queries`} />
        <Step Icon={Globe} title="FastAPI to this screen" detail="JSON over HTTP" last />
      </div>
    </Panel>
  );
}

function QueryExplorer({ metas, scored }: { metas: Meta[]; scored: boolean }) {
  const { demo } = useDataset();
  const [sel, setSel] = useState(metas[0]?.name ?? "");
  const [res, setRes] = useState<QueryResult<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = metas.find((m) => m.name === sel);
  const blocked = !!meta?.needs_sentiment && !scored;

  const run = useCallback(async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      setRes(await get<QueryResult<Record<string, unknown>>>("/api/spark/" + name));
    } catch (e) {
      setRes(null);
      setError(e instanceof ApiError ? e.message : "Query failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const m = metas.find((x) => x.name === sel);
    if (!m) return;
    if (m.needs_sentiment && !scored) { setRes(null); setError(null); return; }
    void run(sel);
  }, [sel, scored, metas, run]);

  const cols = res && res.rows.length ? Object.keys(res.rows[0]) : [];
  const core = metas.filter((m) => !m.needs_sentiment);
  const sent = metas.filter((m) => m.needs_sentiment);

  const List = ({ title, items }: { title: string; items: Meta[] }) => (
    <div>
      <p className="mb-1.5 px-2 text-xs font-medium text-muted">{title}</p>
      {items.map((m) => (
        <button
          key={m.name} onClick={() => setSel(m.name)} aria-current={sel === m.name}
          className={cx("block w-full rounded-lg px-2.5 py-2 text-left font-mono text-[12.5px] transition", sel === m.name ? "bg-accent/15 text-accent" : "text-muted hover:bg-raised hover:text-ink")}
        >
          {m.name}
        </button>
      ))}
    </div>
  );

  return (
    <Panel title="Query explorer" subtitle="Every figure in this app comes from one of these Spark SQL queries" bodyClass="!p-0">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <div className="space-y-4 border-b border-line p-4 lg:border-b-0 lg:border-r">
          <List title="Core analytics" items={core} />
          <List title="Needs sentiment scores" items={sent} />
        </div>
        <div className="min-w-0 p-5">
          {meta && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-sm font-semibold">{meta.name}</h3>
                {meta.needs_sentiment && <Pill tone="info">needs sentiment</Pill>}
              </div>
              <p className="mt-1.5 text-sm text-muted">{meta.purpose}</p>
              <p className="mt-2 rounded-lg bg-raised/70 px-3 py-2 text-xs leading-relaxed text-muted"><strong className="text-ink">For management: </strong>{USE[meta.name] ?? "Supports data-driven service decisions."}</p>
              <div className="mt-4">
                {res ? <SqlBlock sql={res.sql} /> : <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{blocked ? "Score the reviews to run this query." : busy ? "Running…" : "The SQL appears once the query has run."}</div>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => run(sel)} disabled={busy || blocked || !!demo}>
                  {busy ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Running…</> : <><Play size={14} aria-hidden /> Run again</>}
                </Button>
                {res && (
                  <span className="text-xs text-muted">
                    {plural(res.row_count, "row")} · {demo ? "saved result from the snapshot" : res.elapsed_ms != null ? `Spark ran this in ${res.elapsed_ms} ms` : "live Spark result"}
                  </span>
                )}
              </div>
              {blocked && <div className="mt-4"><ScoreBanner compact /></div>}
              {error && <p role="alert" className="mt-3 text-sm text-neg">{error}</p>}
              {res && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                  {res.rows.length === 0 ? <p className="p-4 text-sm text-muted">The query returned no rows for this dataset.</p> : (
                    <table className="w-full text-sm">
                      <thead className="bg-raised/60"><tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left font-mono text-xs font-medium text-muted">{c}</th>)}</tr></thead>
                      <tbody>
                        {res.rows.map((r, i) => (
                          <tr key={i} className="border-t border-line">
                            {cols.map((c) => <td key={c} className="px-3 py-2 tabular-nums">{r[c] === null ? <span className="text-faint">null</span> : String(r[c])}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Panel>
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
    get<BenchReport>("/api/benchmark").then(setRep).catch((e) => {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setError(e instanceof ApiError ? e.message : "Could not load the benchmark.");
    });
  }, []);

  if (error) return <Panel title="Benchmark: Spark SQL vs pandas"><p role="alert" className="text-sm text-neg">{error}</p></Panel>;
  if (missing) return <Panel title="Benchmark: Spark SQL vs pandas"><EmptyState title="No benchmark yet" text="On the machine running the backend, run: python -m app.benchmark" /></Panel>;
  if (!rep) return <Skeleton className="h-96" />;

  const total = rep.results.length;
  const pandasWins = rep.results.filter((r) => r.faster === "pandas").length;
  const sparkWins = total - pandasWins;
  const data = rep.results.map((r) => ({ rows: fmtNum(r.rows), "Spark SQL": r.spark_median_s, pandas: r.pandas_median_s }));
  const th = "px-3 py-2 text-left text-xs font-medium text-muted";

  return (
    <Panel
      title="Benchmark: Spark SQL vs pandas"
      subtitle="Same task, same files, timed on one machine. Lower is faster."
      action={<div className="flex gap-2"><Pill tone="warn">Synthetic data: timing only</Pill></div>}
    >
      <ChartBox height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="rows" {...axisProps} label={{ value: "Rows in the CSV", position: "insideBottom", offset: -2, fill: "currentColor", fontSize: 11 }} />
          <YAxis scale="log" domain={[0.01, 1]} ticks={[0.01, 0.1, 1]} allowDataOverflow {...axisProps} unit="s" />
          <Tooltip content={<ChartTip suffix=" s" />} cursor={{ fill: "rgba(148,163,184,.1)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Spark SQL" fill="#FFB02E" radius={[5, 5, 0, 0]} />
          <Bar dataKey="pandas" fill="#8B9BFF" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ChartBox>
      <p className="mt-1 text-center text-[11px] text-faint">Logarithmic scale: each gridline is ten times the one below.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-raised/60"><tr><th className={th}>Rows</th><th className={th}>File</th><th className={th}>Spark SQL</th><th className={th}>pandas</th><th className={th}>Faster</th><th className={th}>Results match</th></tr></thead>
          <tbody>
            {rep.results.map((r) => (
              <tr key={r.rows} className="border-t border-line">
                <td className="px-3 py-2 tabular-nums">{fmtNum(r.rows)}</td>
                <td className="px-3 py-2 tabular-nums text-muted">{r.file_mb} MB</td>
                <td className="px-3 py-2 tabular-nums" title={`runs: ${r.spark_runs_s.join(", ")}`}>{r.spark_median_s}s</td>
                <td className="px-3 py-2 tabular-nums" title={`runs: ${r.pandas_runs_s.join(", ")}`}>{r.pandas_median_s}s</td>
                <td className="px-3 py-2 font-medium">{r.faster === "spark" ? "Spark SQL" : "pandas"} <span className="font-normal text-faint">by {r.speed_ratio}×</span></td>
                <td className="px-3 py-2">{r.results_match ? <Pill tone="positive">yes</Pill> : <Pill tone="negative">NO</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm leading-relaxed">
        <p className="font-display font-semibold">Reading this honestly</p>
        <p className="mt-1 text-muted">
          pandas was faster at {pandasWins} of {total} sizes{sparkWins ? ` and Spark SQL at ${sparkWins}` : ""}. Spark has a fixed start-up cost per job, which dominates small files, and the
          gap narrows as the data grows. Spark is built for data too large for one machine or for clusters, which this single-laptop test does not cover. These numbers do
          not show that Spark is faster. Measured {rep.run_at_utc.replace("T", " ").replace("+00:00", " UTC")}.
        </p>
      </div>

      <details className="group mt-4 text-sm">
        <summary className="inline-flex cursor-pointer items-center gap-1 font-medium text-accent">Methodology, machine and SQL <ArrowRight size={13} className="transition group-open:rotate-90" aria-hidden /></summary>
        <p className="mt-2 text-xs text-muted"><strong className="text-ink">Task:</strong> {rep.task} <strong className="text-ink">Data:</strong> {rep.data}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">{rep.methodology.map((m, i) => <li key={i}>{m}</li>)}</ul>
        <p className="mt-2 text-xs text-faint">{Object.entries(rep.machine).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
        <div className="mt-3"><SqlBlock sql={rep.spark_sql} /></div>
      </details>
    </Panel>
  );
}

export default function Insights() {
  const { ds, version } = useDataset();
  const [metas, setMetas] = useState<Meta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    get<Meta[]>("/api/queries").then((m) => { setMetas(m); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the query list."));
  }, []);
  useEffect(() => { load(); }, [load, version]);

  if (error && !metas) return <ErrorState message={error} onRetry={load} />;
  if (!metas || !ds) return <div aria-busy="true" className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-[30rem]" /></div>;

  return (
    <div className="space-y-5">
      <Rise i={0}><Pipeline ds={ds} queryCount={metas.length} /></Rise>
      <Rise i={1}><QueryExplorer metas={metas} scored={!!ds.sentiment} /></Rise>
      <Rise i={2}><Benchmark /></Rise>
    </div>
  );
}
