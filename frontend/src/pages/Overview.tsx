import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ApiError, get, post } from "../api";
import type { Dataset, QueryResult } from "../api";
import { Card, Kpi, Skeleton } from "../ui";

type Airline = { airline: string; total_reviews: number };
type Avg = { airline: string; avg_rating: number | null; rated_reviews: number };
type Dist = { rating: number; reviews: number };
type Sent = { sentiment: "positive" | "neutral" | "negative"; reviews: number; pct: number };
type Trend = { month: string; reviews: number; negative: number; negative_pct: number };
interface Data {
  ds: Dataset; airlines: Airline[]; avg: Avg[]; dist: Dist[]; sent: Sent[] | null; trend: Trend[] | null;
}

const COLORS = { positive: "#10b981", neutral: "#94a3b8", negative: "#f43f5e" };
const tip = {
  contentStyle: { background: "rgba(10,21,48,.95)", border: "none", borderRadius: 12, color: "#e2e8f0" },
  itemStyle: { color: "#e2e8f0" },
  labelStyle: { color: "#7dd3fc" },
};
const axis = { tick: { fill: "currentColor", fontSize: 12 }, stroke: "currentColor", strokeOpacity: 0.3 };
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

function ChartBox({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-64 text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
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
        <button onClick={refresh} className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
          Try again
        </button>
      </Card>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80" />)}
        </div>
      </div>
    );
  }

  const { ds, airlines, avg, dist, sent, trend } = data;
  if (ds.cleaning_report.rows_kept === 0) {
    return <Card><p className="text-sm">The dataset has no usable reviews after cleaning.</p></Card>;
  }

  const ratedTotal = avg.reduce((s, r) => s + r.rated_reviews, 0);
  const avgRating = ratedTotal ? avg.reduce((s, r) => s + (r.avg_rating ?? 0) * r.rated_reviews, 0) / ratedTotal : null;
  const pct = (label: Sent["sentiment"]) => {
    const row = sent?.find((s) => s.sentiment === label);
    return sent ? `${(row?.pct ?? 0).toFixed(1)}%` : "—";
  };
  const unscoredHint = "Score reviews to see this";
  const cr = ds.cleaning_report;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-medium">{ds.source}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Cleaning: {cr.rows_in} rows read, {cr.rows_kept} kept, {cr.rows_removed} removed (empty or duplicate),{" "}
          {cr.invalid_ratings_nulled} invalid ratings ignored.
        </p>
      </Card>

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</p>}

      {!sent && (
        <Card>
          <p className="text-sm font-medium">Sentiment has not been calculated yet</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            The transformer model scores every review. The first run downloads the model (about 500 MB) and can
            take several minutes; later runs are fast.
          </p>
          <button
            onClick={score}
            disabled={scoring}
            className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {scoring ? "Scoring reviews…" : "Score reviews with the transformer"}
          </button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Reviews" value={String(cr.rows_kept)} />
        <Kpi label="Airlines" value={String(airlines.length)} />
        <Kpi label="Avg rating" value={avgRating === null ? "—" : avgRating.toFixed(2)} hint="Out of 10" />
        <Kpi label="Positive" value={pct("positive")} accent="text-emerald-500" hint={sent ? undefined : unscoredHint} />
        <Kpi label="Neutral" value={pct("neutral")} accent="text-slate-400" hint={sent ? undefined : unscoredHint} />
        <Kpi label="Negative" value={pct("negative")} accent="text-rose-500" hint={sent ? undefined : unscoredHint} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sentiment distribution">
          {sent ? (
            <ChartBox>
              <PieChart>
                <Pie data={sent} dataKey="reviews" nameKey="sentiment" innerRadius={55} outerRadius={90} paddingAngle={3}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
              <XAxis dataKey="airline" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "rgba(125,211,252,.1)" }} />
              <Bar dataKey="total_reviews" name="Reviews" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>

        <Card title="Rating distribution (1–10)">
          <ChartBox>
            <BarChart data={dist}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
              <XAxis dataKey="rating" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "rgba(125,211,252,.1)" }} />
              <Bar dataKey="reviews" name="Reviews" fill="#22d3ee" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>

        <Card title="Negative reviews over time (% of month)">
          {trend ? (
            <ChartBox>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
                <XAxis dataKey="month" {...axis} />
                <YAxis domain={[0, 100]} unit="%" {...axis} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="negative_pct" name="Negative %" stroke="#f43f5e" strokeWidth={2} dot />
              </LineChart>
            </ChartBox>
          ) : <p className="text-sm text-slate-500">Available after scoring.</p>}
        </Card>
      </div>
    </div>
  );
}
