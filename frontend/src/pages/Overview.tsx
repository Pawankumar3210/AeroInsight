import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { ApiError, get, post } from "../api";
import type { Dataset, QueryResult } from "../api";
import { axis, tip } from "../chartStyle";
import { ChartBox } from "../components";
import { Card, Kpi, Skeleton } from "../ui";

type Airline = { airline: string; total_reviews: number };
type Avg = { airline: string; avg_rating: number | null; rated_reviews: number };
type Dist = { rating: number; reviews: number };
type Sent = { sentiment: "positive" | "neutral" | "negative"; reviews: number; pct: number };
type Trend = { month: string; reviews: number; negative: number; negative_pct: number };
interface Data {
  ds: Dataset; airlines: Airline[]; avg: Avg[]; dist: Dist[]; sent: Sent[] | null; trend: Trend[] | null;
}

const COLORS = { positive: "#10B981", neutral: "#94A3B8", negative: "#F4617F" };
const q = <R,>(name: string) => get<QueryResult<R>>("/api/spark/" + name);

async function loadAll(): Promise<Data> {
  const [ds, airlines, avg, dist] = await Promise.all([
    get<Dataset>("/api/dataset"), q<Airline>("reviews_by_airline"),
    q<Avg>("avg_rating_by_airline"), q<Dist>("rating_distribution"),
  ]);
  let sent: Sent[] | null = null;
  let trend: Trend[] | null = null;
  if (ds.sentiment) {
    const [s, t] = await Promise.all([q<Sent>("sentiment_counts"), q<Trend>("negative_trend_monthly")]);
    sent = s.rows;
    trend = t.rows;
  }
  return { ds, airlines: airlines.rows, avg: avg.rows, dist: dist.rows, sent, trend };
}

function Hero({ headline, sub, chip }: { headline: string; sub: string; chip: string }) {
  const [still] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const plane = "M14 0 L-7 -8 L-3 0 L-7 8 Z";
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B1226] text-white">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 260px at 85% 125%, rgba(245,165,36,.30), transparent 60%), radial-gradient(700px 300px at 8% -25%, rgba(51,197,178,.18), transparent 60%)",
        }}
      />
      <svg aria-hidden viewBox="0 0 800 220" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="trail" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#33C5B2" stopOpacity="0" />
            <stop offset="0.55" stopColor="#33C5B2" />
            <stop offset="1" stopColor="#F5A524" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="640" cy="270" rx={190 + i * 120} ry={110 + i * 62} fill="none" stroke="#fff" strokeOpacity="0.06" />
        ))}
        <path
          id="route"
          d="M 330 205 C 470 205 560 45 780 48"
          pathLength={1}
          fill="none"
          stroke="url(#trail)"
          strokeWidth="2"
          strokeLinecap="round"
          className={still ? "" : "route-draw"}
        />
        <circle cx="330" cy="205" r="4" fill="#33C5B2" />
        <circle cx="780" cy="48" r="4" fill="#F5A524" />
        {still ? (
          <g transform="translate(780 48) rotate(1)"><path d={plane} fill="#fff" /></g>
        ) : (
          <g>
            <path d={plane} fill="#fff" />
            <animateMotion dur="3.4s" begin="0.2s" fill="freeze" rotate="auto" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1">
              <mpath href="#route" />
            </animateMotion>
          </g>
        )}
      </svg>
      <div className="relative max-w-xl px-6 py-10 sm:px-10 sm:py-14">
        <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{headline}</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">{sub}</p>
        <p className="mt-5 inline-block rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">{chip}</p>
      </div>
    </section>
  );
}

export default function Overview() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setData(await loadAll());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong while loading data.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function score() {
    setScoring(true);
    setError(null);
    try {
      await post("/api/sentiment/score");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Scoring failed.");
    } finally {
      setScoring(false);
    }
  }

  if (error && !data) {
    return (
      <Card>
        <p role="alert" className="font-medium text-rose-500">Could not load data</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{error}</p>
        <button onClick={refresh} className="mt-4 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700">
          Try again
        </button>
      </Card>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-28" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80" />)}
        </div>
      </div>
    );
  }

  const { ds, airlines, avg, dist, sent, trend } = data;
  const cr = ds.cleaning_report;
  if (cr.rows_kept === 0) {
    return <Card><p className="text-sm">The dataset has no usable reviews after cleaning. Check the file and upload it again.</p></Card>;
  }

  const ratedTotal = avg.reduce((s, r) => s + r.rated_reviews, 0);
  const avgRating = ratedTotal ? avg.reduce((s, r) => s + (r.avg_rating ?? 0) * r.rated_reviews, 0) / ratedTotal : null;
  const pct = (label: Sent["sentiment"]) => {
    const row = sent?.find((s) => s.sentiment === label);
    return sent ? `${(row?.pct ?? 0).toFixed(1)}%` : "n/a";
  };
  const negPct = sent?.find((s) => s.sentiment === "negative")?.pct ?? 0;
  const unscored = "Score reviews to see this";
  const isDemo = ds.source.startsWith("Demo");

  return (
    <div className="space-y-4">
      <Hero
        headline={sent ? `${negPct.toFixed(0)}% of ${cr.rows_kept} reviews read as negative` : `${cr.rows_kept} reviews cleaned and ready to score`}
        sub={
          sent
            ? "Spark SQL counted them and a transformer model read each review. Confidence is not the same as accuracy."
            : "Spark SQL has cleaned the data. Score the reviews to see how passengers felt."
        }
        chip={isDemo ? "Invented demo data, not real airlines" : ds.source}
      />

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</p>}

      {!sent && (
        <Card>
          <p className="text-sm font-medium text-slate-900 dark:text-white">Sentiment has not been calculated yet</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            The transformer model scores every review. The first run downloads the model (about 500 MB) and can
            take several minutes. Later runs are fast.
          </p>
          <button
            onClick={score}
            disabled={scoring}
            className="mt-3 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:opacity-60"
          >
            {scoring ? "Scoring reviews…" : "Score reviews with the transformer"}
          </button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-3 xl:grid-cols-6 dark:border-white/[0.07] dark:bg-white/[0.07]">
        <Kpi label="Reviews" value={String(cr.rows_kept)} />
        <Kpi label="Airlines" value={String(airlines.length)} />
        <Kpi label="Average rating" value={avgRating === null ? "n/a" : avgRating.toFixed(2)} hint="Out of 10" />
        <Kpi label="Positive" value={pct("positive")} accent="text-emerald-600 dark:text-emerald-400" hint={sent ? undefined : unscored} />
        <Kpi label="Neutral" value={pct("neutral")} accent="text-slate-500 dark:text-slate-300" hint={sent ? undefined : unscored} />
        <Kpi label="Negative" value={pct("negative")} accent="text-rose-600 dark:text-rose-400" hint={sent ? undefined : unscored} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Cleaning: {cr.rows_in} rows read, {cr.rows_kept} kept, {cr.rows_removed} removed (empty or duplicate),{" "}
        {cr.invalid_ratings_nulled} invalid ratings ignored.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sentiment distribution">
          {sent ? (
            <ChartBox>
              <PieChart>
                <Pie data={sent} dataKey="reviews" nameKey="sentiment" innerRadius={58} outerRadius={92} paddingAngle={3} stroke="none">
                  {sent.map((s) => <Cell key={s.sentiment} fill={COLORS[s.sentiment]} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ChartBox>
          ) : <p className="text-sm text-slate-500">Available after scoring.</p>}
        </Card>

        <Card title="Reviews per airline">
          <ChartBox>
            <BarChart data={airlines}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
              <XAxis dataKey="airline" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "rgba(43,181,166,.1)" }} />
              <Bar dataKey="total_reviews" name="Reviews" fill="#2BB5A6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>

        <Card title="Rating distribution (1 to 10)">
          <ChartBox>
            <BarChart data={dist}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
              <XAxis dataKey="rating" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "rgba(43,181,166,.1)" }} />
              <Bar dataKey="reviews" name="Reviews" fill="#8B9BFF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>

        <Card title="Negative reviews over time (% of each month)">
          {trend ? (
            <ChartBox>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="month" {...axis} />
                <YAxis domain={[0, 100]} unit="%" {...axis} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="negative_pct" name="Negative %" stroke="#F4617F" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ChartBox>
          ) : <p className="text-sm text-slate-500">Available after scoring.</p>}
        </Card>
      </div>
    </div>
  );
}
