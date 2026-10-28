import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertCircle, ArrowRight, CheckCircle2, Info, Loader2, RotateCcw, SlidersHorizontal, TrendingDown, Zap } from "lucide-react";
import { ApiError, get } from "../api";
import { ChartBox, ChartTip, CountUp, ScoreBanner, Sparkline, axisProps } from "../components";
import { useDataset } from "../context";
import Hero from "../Hero";
import { buildInsights } from "../insights";
import type { Insight } from "../insights";
import { SENT_COLOR, cx, monthLabel, plural, ratingColor } from "../lib";
import type { DashboardData, Sentiment } from "../types";
import { Button, EmptyState, ErrorState, Field, Panel, Pill, Rise, Segmented, Skeleton, inputCls } from "../ui";

interface Filters { airline: string; sentiment: "" | Sentiment; min: string; max: string; from: string; to: string }
const NONE: Filters = { airline: "", sentiment: "", min: "", max: "", from: "", to: "" };
const RATINGS = Array.from({ length: 10 }, (_, i) => String(i + 1));

function toParams(f: Filters): string {
  const p = new URLSearchParams();
  if (f.airline) p.set("airline", f.airline);
  if (f.sentiment) p.set("sentiment", f.sentiment);
  if (f.min) p.set("min_rating", f.min);
  if (f.max) p.set("max_rating", f.max);
  if (f.from) p.set("date_from", f.from);
  if (f.to) p.set("date_to", f.to);
  return p.toString();
}

function KpiCell({ label, hint, children, spark, sparkColor }: {
  label: string; hint?: string; children: React.ReactNode; spark?: number[]; sparkColor?: string;
}) {
  return (
    <div className="flex flex-col justify-between bg-panel p-5 transition-colors duration-300 hover:bg-raised">
      <div>
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-2 font-display text-[1.9rem] font-semibold leading-none tracking-tight">{children}</p>
        {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
      </div>
      {spark && <div className="mt-4"><Sparkline values={spark} color={sparkColor} /></div>}
    </div>
  );
}

const TONE_ICON = { negative: TrendingDown, positive: CheckCircle2, info: Info, warn: AlertCircle } as const;
const TONE_CLS = {
  negative: "text-neg bg-neg/15", positive: "text-pos bg-pos/15", info: "text-accent bg-accent/15", warn: "text-warn bg-warn/15",
} as const;

function InsightCard({ i }: { i: Insight }) {
  const Icon = TONE_ICON[i.tone];
  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-raised/60 p-4 transition duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg">
      <span className={cx("grid h-8 w-8 place-items-center rounded-lg", TONE_CLS[i.tone])}><Icon size={16} aria-hidden /></span>
      <p className="mt-3 font-display text-sm font-semibold leading-snug">{i.title}</p>
      <p className="mt-1 text-sm text-muted">{i.body}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted"><span className="font-semibold text-ink">What to do: </span>{i.action}</p>
      {i.to && (
        <Link to={i.to} className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-accent hover:underline">
          {i.cta} <ArrowRight size={12} aria-hidden />
        </Link>
      )}
    </div>
  );
}

export default function Overview() {
  const { ds, version, demo, scoring, score } = useDataset();
  const [f, setF] = useState<Filters>(NONE);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const params = useMemo(() => toParams(f), [f]);
  const active = Object.values(f).filter(Boolean).length;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<DashboardData>("/api/dashboard" + (params ? "?" + params : ""))
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Something went wrong while loading data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params, version, retry]);

  if (error && !data) return <ErrorState message={error} onRetry={() => setRetry((r) => r + 1)} />;

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-[19rem] !rounded-3xl" />
        <Skeleton className="h-32" />
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-80" /><Skeleton className="h-80 lg:col-span-2" /></div>
      </div>
    );
  }

  const d = data;
  const k = d.kpis;
  const cr = ds?.cleaning_report;
  const count = (s: Sentiment) => d.sentiment.find((x) => x.sentiment === s);
  const neg = count("negative");
  const isDemoData = ds?.source.startsWith("Demo");
  const insights = buildInsights(d);
  const monthRows = d.monthly.map((m) => ({
    label: monthLabel(m.month), reviews: m.reviews,
    metric: d.scored ? (m.negative_pct ?? null) : (m.avg_rating ?? null),
  }));
  const dist = RATINGS.map((r) => ({ rating: r, reviews: d.rating_distribution.find((x) => String(x.rating) === r)?.reviews ?? 0 }));
  const maxMention = Math.max(1, ...d.complaints.map((c) => c.mentions));
  const topAirlines = d.airlines.slice(0, 5);

  const headline = k.reviews === 0
    ? <>No reviews match these filters</>
    : d.scored
      ? <><CountUp value={neg?.pct ?? 0} decimals={0} suffix="%" /> of {k.reviews.toLocaleString("en-US")} reviews read as negative</>
      : <>{k.reviews.toLocaleString("en-US")} reviews cleaned and ready to score</>;
  const sub = k.reviews === 0
    ? "Loosen a filter above to see results again."
    : d.scored
      ? "Spark SQL did the counting and a transformer model read each review. Confidence is not the same as accuracy."
      : "Spark SQL has cleaned and counted the data. Score the reviews to see how passengers felt.";

  return (
    <div className="space-y-5">
      <div className={cx("space-y-5 transition-opacity duration-200", loading && "opacity-60")}>
        <Rise i={0}>
          <Hero
            headline={headline}
            sub={sub}
            chip={isDemoData ? "Invented demo data, not real airlines" : (ds?.source ?? "Dataset")}
            routes={d.airlines.map((a) => ({ name: a.airline, rating: a.avg_rating }))}
            action={!d.scored && !demo && k.reviews > 0 ? (
              <Button variant="primary" onClick={score} disabled={scoring}>
                {scoring ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Scoring…</> : "Score reviews with the transformer"}
              </Button>
            ) : undefined}
          />
        </Rise>

        {!d.scored && <ScoreBanner />}

        <Rise i={2}>
        <Panel bodyClass="!p-4">
          {demo ? (
            <p className="flex items-center gap-2 text-sm text-muted"><Zap size={14} className="text-accent" aria-hidden /> Filters run Spark SQL on the live server, so they are off in this saved snapshot.</p>
          ) : (
          <>
          <button
            onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}
            className="mb-1 flex w-full items-center justify-between rounded-lg border border-line bg-raised px-3 py-2 text-sm font-medium sm:hidden"
          >
            <span className="flex items-center gap-2"><SlidersHorizontal size={15} aria-hidden /> Filters{active ? ` (${active} active)` : ""}</span>
            <span className="text-xs text-muted">{showFilters ? "Hide" : "Show"}</span>
          </button>
          <div className={cx("flex-wrap items-end gap-3 max-sm:mt-3", showFilters ? "flex" : "hidden sm:flex")}>
            <Field label="Airline" htmlFor="o-airline" className="w-40">
              <select id="o-airline" className={inputCls} value={f.airline} onChange={(e) => set("airline", e.target.value)}>
                <option value="">All airlines</option>
                {d.options.airlines.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Sentiment</p>
              <Segmented
                label="Sentiment filter" value={f.sentiment} disabled={!ds?.sentiment}
                onChange={(v) => set("sentiment", v)}
                options={[{ value: "", label: "All" }, { value: "positive", label: "Positive" }, { value: "neutral", label: "Neutral" }, { value: "negative", label: "Negative" }]}
              />
            </div>
            <Field label="Min rating" htmlFor="o-min" className="w-24">
              <select id="o-min" className={inputCls} value={f.min} onChange={(e) => set("min", e.target.value)}>
                <option value="">Any</option>{RATINGS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Max rating" htmlFor="o-max" className="w-24">
              <select id="o-max" className={inputCls} value={f.max} onChange={(e) => set("max", e.target.value)}>
                <option value="">Any</option>{RATINGS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="From" htmlFor="o-from" className="w-40">
              <input id="o-from" type="date" className={inputCls} value={f.from} min={d.options.date_min ?? undefined} max={d.options.date_max ?? undefined} onChange={(e) => set("from", e.target.value)} />
            </Field>
            <Field label="To" htmlFor="o-to" className="w-40">
              <input id="o-to" type="date" className={inputCls} value={f.to} min={d.options.date_min ?? undefined} max={d.options.date_max ?? undefined} onChange={(e) => set("to", e.target.value)} />
            </Field>
            <Button variant="quiet" onClick={() => setF(NONE)} disabled={!active}><RotateCcw size={14} aria-hidden /> Reset{active ? ` (${active})` : ""}</Button>
            <div className="ml-auto flex items-center gap-2 pb-1 text-xs text-muted">
              {loading ? <Loader2 size={14} className="animate-spin text-accent" aria-label="Updating" /> : <Zap size={14} className="text-accent" aria-hidden />}
              <span title={d.cached ? "Spark computed this earlier for the same filters; it is reused until the data changes." : undefined}>{d.cached ? "Spark SQL · cached result" : `Spark SQL · ${d.elapsed_ms} ms`}</span>
            </div>
          </div>
          </>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-neg">{error}</p>}
        </Panel>
      </Rise>

        <Rise i={2}>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-panel lg:grid-cols-3 xl:grid-cols-6">
            <KpiCell label="Reviews" hint={cr && cr.rows_removed && !active ? `${cr.rows_removed} removed in cleaning` : undefined} spark={d.monthly.map((m) => m.reviews)}>
              <CountUp value={k.reviews} />
            </KpiCell>
            <KpiCell label="Airlines" hint="With at least one review"><CountUp value={k.airlines} /></KpiCell>
            <KpiCell label="Average rating" hint={`Out of 10 · ${k.rated_reviews} rated`} spark={d.monthly.flatMap((m) => (m.avg_rating == null ? [] : [m.avg_rating]))} sparkColor="#FFB02E">
              {k.avg_rating == null ? "n/a" : <CountUp value={k.avg_rating} decimals={2} />}
            </KpiCell>
            <KpiCell label="Positive" hint={d.scored ? plural(count("positive")?.reviews ?? 0, "review") : "Not scored yet"}>
              <span className="text-pos">{d.scored ? <CountUp value={count("positive")?.pct ?? 0} decimals={1} suffix="%" /> : "n/a"}</span>
            </KpiCell>
            <KpiCell label="Neutral" hint={d.scored ? plural(count("neutral")?.reviews ?? 0, "review") : "Not scored yet"}>
              <span className="text-neu">{d.scored ? <CountUp value={count("neutral")?.pct ?? 0} decimals={1} suffix="%" /> : "n/a"}</span>
            </KpiCell>
            <KpiCell label="Negative" hint={d.scored ? plural(neg?.reviews ?? 0, "review") : "Not scored yet"} spark={d.scored ? d.monthly.flatMap((m) => (m.negative_pct == null ? [] : [m.negative_pct])) : undefined} sparkColor="#FF6B81">
              <span className="text-neg">{d.scored ? <CountUp value={neg?.pct ?? 0} decimals={1} suffix="%" /> : "n/a"}</span>
            </KpiCell>
          </div>
        </Rise>

        {insights.length > 0 && (
          <Rise i={3}>
            <Panel title="What stands out" subtitle="Written from the numbers on this page. Read the caveats: small samples can mislead.">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {insights.map((i) => <InsightCard key={i.title} i={i} />)}
              </div>
            </Panel>
          </Rise>
        )}

        {k.reviews === 0 ? (
          <Panel><EmptyState title="Nothing to chart" text="No reviews match the current filters." action={<Button onClick={() => setF(NONE)}>Reset filters</Button>} /></Panel>
        ) : (
          <>
            <Rise i={4}>
              <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Sentiment mix" subtitle="Share of reviews the model read as positive, neutral or negative">
                  {d.scored ? (
                    <>
                      <div className="relative">
                        <ChartBox height={210}>
                          <PieChart>
                            <Pie data={d.sentiment} dataKey="reviews" nameKey="sentiment" innerRadius={64} outerRadius={92} paddingAngle={3} stroke="none" cornerRadius={4}>
                              {d.sentiment.map((s) => <Cell key={s.sentiment} fill={SENT_COLOR[s.sentiment]} />)}
                            </Pie>
                            <Tooltip content={<ChartTip />} />
                          </PieChart>
                        </ChartBox>
                        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                          <div>
                            <p className="font-display text-3xl font-semibold leading-none">{k.reviews}</p>
                            <p className="mt-1 text-xs text-muted">reviews</p>
                          </div>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {(["positive", "neutral", "negative"] as Sentiment[]).map((s) => (
                          <li key={s} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 capitalize text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SENT_COLOR[s] }} />{s}</span>
                            <span className="font-medium">{count(s)?.reviews ?? 0} <span className="text-faint">· {(count(s)?.pct ?? 0).toFixed(1)}%</span></span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : <EmptyState title="Waiting for scores" text="Score the reviews to see the sentiment mix." />}
                </Panel>

                <Panel title={d.scored ? "Volume and negative share by month" : "Volume and average rating by month"} subtitle="Bars show how many reviews arrived; the line shows the trend" className="lg:col-span-2">
                  {monthRows.length === 0 ? <EmptyState title="No dated reviews" text="Reviews need a valid date (YYYY-MM-DD) to appear in a trend." /> : (
                    <ChartBox height={290}>
                      <ComposedChart data={monthRows} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#4FE3C1" stopOpacity="0.85" />
                            <stop offset="1" stopColor="#4FE3C1" stopOpacity="0.15" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                        <XAxis dataKey="label" {...axisProps} />
                        <YAxis yAxisId="l" allowDecimals={false} {...axisProps} />
                        <YAxis yAxisId="r" orientation="right" domain={d.scored ? [0, 100] : [0, 10]} unit={d.scored ? "%" : ""} {...axisProps} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(79,227,193,.07)" }} />
                        <Bar yAxisId="l" dataKey="reviews" name="Reviews" fill="url(#gBar)" radius={[7, 7, 0, 0]} maxBarSize={48} />
                        <Line yAxisId="r" type="monotone" dataKey="metric" name={d.scored ? "Negative %" : "Avg rating"} stroke={d.scored ? "#FF6B81" : "#FFB02E"} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0, fill: d.scored ? "#FF6B81" : "#FFB02E" }} activeDot={{ r: 6 }} connectNulls animationDuration={1300} />
                      </ComposedChart>
                    </ChartBox>
                  )}
                </Panel>
              </div>
            </Rise>

            <Rise i={5}>
              <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="How passengers rated" subtitle="Reviews at each rating, 1 to 10">
                  <ChartBox height={230}>
                    <BarChart data={dist} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                      <XAxis dataKey="rating" {...axisProps} />
                      <YAxis allowDecimals={false} {...axisProps} />
                      <Tooltip content={<ChartTip labelFormatter={(l) => `Rating ${l}`} />} cursor={{ fill: "rgba(148,163,184,.1)" }} />
                      <Bar dataKey="reviews" name="Reviews" radius={[6, 6, 0, 0]}>
                        {dist.map((x) => <Cell key={x.rating} fill={ratingColor(Number(x.rating))} />)}
                      </Bar>
                    </BarChart>
                  </ChartBox>
                </Panel>

                <Panel title="Complaint themes" subtitle="In reviews rated 4 or below. Keyword match, so synonyms are missed.">
                  {d.complaints.every((c) => c.mentions === 0) ? (
                    <EmptyState title="No themes found" text="No complaint keywords appear in low-rated reviews in this view." />
                  ) : (
                    <ul className="space-y-3.5">
                      {d.complaints.map((c, i) => (
                        <li key={c.category}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="text-muted">{c.category}</span>
                            <span className="font-medium">{c.mentions}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-raised">
                            <div className="grow-x h-full rounded-full bg-gradient-to-r from-[#FFB02E] to-[#FF6B81]" style={{ width: `${(c.mentions / maxMention) * 100}%`, animationDelay: `${i * 80}ms` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Airlines at a glance" subtitle="Average rating out of 10" action={<Link to="/compare" className="text-xs font-semibold text-accent hover:underline">Compare all</Link>}>
                  <ul className="space-y-3.5">
                    {topAirlines.map((a, i) => (
                      <li key={a.airline}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{a.airline}</span>
                          <span className="flex items-center gap-2">
                            {a.rated_reviews < d.min_sample && <Pill tone="warn" title={`Fewer than ${d.min_sample} rated reviews`}>small sample</Pill>}
                            <span className="font-display font-semibold">{a.avg_rating == null ? "n/a" : a.avg_rating.toFixed(1)}</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-raised">
                          <div className="grow-x h-full rounded-full" style={{ width: `${((a.avg_rating ?? 0) / 10) * 100}%`, background: ratingColor(a.avg_rating ?? 0), animationDelay: `${i * 80}ms` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-faint">{plural(a.reviews, "review")}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </Rise>
          </>
        )}

        {cr && (
          <p className="px-1 text-xs text-faint">
            Data cleaning: {cr.rows_in} rows read, {cr.rows_kept} kept, {cr.rows_removed} removed (empty or duplicate),{" "}
            {cr.invalid_ratings_nulled} invalid ratings ignored in averages. Dates outside the file&apos;s range are not guessed.
          </p>
        )}
      </div>
    </div>
  );
}
