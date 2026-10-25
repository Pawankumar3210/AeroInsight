import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ApiError, get } from "../api";
import type { Dataset, QueryResult } from "../api";
import { axis, tip } from "../chartStyle";
import { ChartBox, ScoreNotice } from "../components";
import { Card, Skeleton } from "../ui";

type Total = { airline: string; total_reviews: number };
type Avg = { airline: string; avg_rating: number | null; rated_reviews: number };
type Low = { airline: string; rated_reviews: number; low_rated: number; low_rating_pct: number };
type Neg = { airline: string; scored_reviews: number; negative: number; negative_pct: number };
type Complaint = { category: string; mentions: number };
interface Data {
  ds: Dataset; totals: Total[]; avg: Avg[]; low: Low[]; complaints: Complaint[]; neg: Neg[] | null;
}

const q = <R,>(name: string) => get<QueryResult<R>>("/api/spark/" + name);
const pct = (v: number | null) => (v === null ? "n/a" : v.toFixed(1) + "%");

async function loadAll(): Promise<Data> {
  const [ds, totals, avg, low, complaints] = await Promise.all([
    get<Dataset>("/api/dataset"), q<Total>("reviews_by_airline"), q<Avg>("avg_rating_by_airline"),
    q<Low>("low_rating_share_by_airline"), q<Complaint>("complaint_categories"),
  ]);
  const neg = ds.sentiment ? (await q<Neg>("negative_share_by_airline")).rows : null;
  return { ds, totals: totals.rows, avg: avg.rows, low: low.rows, complaints: complaints.rows, neg };
}

export default function Compare() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadAll());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong while loading data.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <Card>
        <p role="alert" className="font-medium text-rose-500">Could not load data</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={load} className="mt-4 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white">Try again</button>
      </Card>
    );
  }
  if (!data) {
    return <div aria-busy="true" className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>;
  }

  const { ds, totals, avg, low, complaints, neg } = data;
  const rows = totals.map((t) => ({
    airline: t.airline,
    total: t.total_reviews,
    avg: avg.find((a) => a.airline === t.airline)?.avg_rating ?? null,
    low: low.find((a) => a.airline === t.airline)?.low_rating_pct ?? null,
    neg: neg?.find((a) => a.airline === t.airline)?.negative_pct ?? null,
  }));
  const th = "px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400";
  const td = "px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Airline comparison</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{ds.source}</p>
      {!ds.sentiment && <ScoreNotice onDone={load} />}

      <Card title="Airlines side by side">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Airline</th><th className={th}>Reviews</th><th className={th}>Avg rating</th>
                <th className={th}>Rated ≤ 4</th><th className={th}>Negative sentiment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.airline} className="border-t border-slate-200 dark:border-white/10">
                  <td className={`${td} font-medium`}>{r.airline}</td>
                  <td className={td}>{r.total}</td>
                  <td className={td}>{r.avg === null ? "n/a" : r.avg.toFixed(2)}</td>
                  <td className={td} title={r.low === null ? "Too few rated reviews" : undefined}>{pct(r.low)}</td>
                  <td className={td} title={r.neg === null ? "Not scored, or too few reviews" : undefined}>{pct(r.neg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          “n/a” means no value, or too few reviews to compare fairly. Percentages from very small samples are misleading,
          so airlines below the minimum sample size (set by MIN_AIRLINE_SAMPLE on the backend; 3 for the demo file, use
          30 or more with real data) are left out.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Average rating (out of 10)">
          <ChartBox>
            <BarChart data={rows.filter((r) => r.avg !== null)}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
              <XAxis dataKey="airline" {...axis} />
              <YAxis domain={[0, 10]} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "rgba(43,181,166,.1)" }} />
              <Bar dataKey="avg" name="Avg rating" fill="#2BB5A6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Share of reviews rated 4 or below (%)">
          <ChartBox>
            <BarChart data={rows.filter((r) => r.low !== null)}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
              <XAxis dataKey="airline" {...axis} />
              <YAxis domain={[0, 100]} unit="%" {...axis} />
              <Tooltip {...tip} cursor={{ fill: "rgba(43,181,166,.1)" }} />
              <Bar dataKey="low" name="Rated ≤ 4 (%)" fill="#F5A524" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Share of negative-sentiment reviews (%)">
          {neg ? (
            <ChartBox>
              <BarChart data={rows.filter((r) => r.neg !== null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
                <XAxis dataKey="airline" {...axis} />
                <YAxis domain={[0, 100]} unit="%" {...axis} />
                <Tooltip {...tip} cursor={{ fill: "rgba(43,181,166,.1)" }} />
                <Bar dataKey="neg" name="Negative (%)" fill="#F4617F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartBox>
          ) : <p className="text-sm text-slate-500">Available after scoring.</p>}
        </Card>
        <Card title="Complaint themes in low-rated reviews">
          <ChartBox>
            <BarChart data={complaints} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="category" width={110} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "rgba(43,181,166,.1)" }} />
              <Bar dataKey="mentions" name="Mentions" fill="#8B9BFF" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartBox>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Found by keyword matching in reviews rated 4 or below. A review can count in several themes.
          </p>
        </Card>
      </div>

      <Card title="How management could use this">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Compare average rating and negative share to see which airlines passengers are happiest or unhappiest with.</li>
          <li>Treat a high negative share as a prompt to read that airline’s reviews, not as proof of a problem.</li>
          <li>Use the complaint themes to decide which area (delays, baggage, service, seating…) to investigate first.</li>
          <li>Check the review counts before drawing conclusions. Small samples can mislead.</li>
        </ul>
      </Card>
    </div>
  );
}
