import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, LabelList, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ArrowRight, Lightbulb } from "lucide-react";
import { ApiError, get } from "../api";
import type { QueryResult } from "../api";
import { ChartBox, ScoreBanner, axisProps } from "../components";
import { useDataset } from "../context";
import { COMPLAINT_SEARCH } from "../insights";
import { cx, fmtPct, plural, ratingColor } from "../lib";
import type { AirlineRow, DashboardData } from "../types";
import { EmptyState, ErrorState, Panel, Pill, Rise, Segmented, Skeleton } from "../ui";

type SortKey = "reviews" | "rating" | "negative";
interface Cell { airline: string; category: string; mentions: number }
interface Point { airline: string; x: number; y: number; z: number }

function ScatterTip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-xl">
      <p className="font-display font-semibold">{p.airline}</p>
      <p className="mt-1 text-muted">Average rating: <span className="font-medium text-ink">{p.x.toFixed(2)}</span></p>
      <p className="text-muted">Negative share: <span className="font-medium text-ink">{p.y.toFixed(1)}%</span></p>
      <p className="text-muted">Reviews: <span className="font-medium text-ink">{p.z}</span></p>
    </div>
  );
}

function Bar({ value, max, color, delay = 0 }: { value: number | null; max: number; color: string; delay?: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-raised">
      {value != null && <div className="grow-x h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, animationDelay: `${delay}ms` }} />}
    </div>
  );
}

export default function Compare() {
  const { version } = useDataset();
  const [d, setD] = useState<DashboardData | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("reviews");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([get<DashboardData>("/api/dashboard"), get<QueryResult<Cell>>("/api/spark/complaints_by_airline")])
      .then(([dash, c]) => { if (!cancelled) { setD(dash); setCells(c.rows); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load the comparison."); });
    return () => { cancelled = true; };
  }, [version, retry]);

  const rows = useMemo(() => {
    if (!d) return [];
    const key = (a: AirlineRow) =>
      sort === "reviews" ? a.reviews : sort === "rating" ? (a.avg_rating ?? -1) : (a.negative_pct ?? -1);
    return [...d.airlines].sort((a, b) => key(b) - key(a));
  }, [d, sort]);

  if (error && !d) return <ErrorState message={error} onRetry={() => setRetry((r) => r + 1)} />;
  if (!d) return <div aria-busy="true" className="space-y-4"><Skeleton className="h-96" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>;
  if (d.airlines.length === 0) return <Panel><EmptyState title="No airlines to compare" text="Upload a CSV with airline names to see this page." /></Panel>;

  const cats = Array.from(new Set(cells.map((c) => c.category)));
  const airlines = d.airlines.map((a) => a.airline);
  const maxCell = Math.max(1, ...cells.map((c) => c.mentions));
  const lookup = new Map(cells.map((c) => [`${c.airline}|${c.category}`, c.mentions]));
  const points: Point[] = d.airlines.flatMap((a) =>
    a.avg_rating != null && a.negative_pct != null ? [{ airline: a.airline, x: a.avg_rating, y: a.negative_pct, z: a.reviews }] : []);
  const th = "px-3 py-2 text-left text-xs font-medium text-muted";

  return (
    <div className="space-y-5">
      {!d.scored && <ScoreBanner compact />}

      <Rise i={0}>
        <Panel
          title="Leaderboard"
          subtitle={`Airlines with fewer than ${d.min_sample} rated reviews are flagged: their percentages swing wildly on a handful of reviews.`}
          action={<Segmented<SortKey> label="Sort airlines by" value={sort} onChange={setSort} options={[{ value: "reviews", label: "Reviews" }, { value: "rating", label: "Rating" }, { value: "negative", label: "Negative share" }]} />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className={cx(th, "w-10")}>#</th><th className={th}>Airline</th><th className={th}>Reviews</th>
                  <th className={cx(th, "w-[22%]")}>Average rating</th><th className={cx(th, "w-[22%]")}>Rated 4 or below</th><th className={cx(th, "w-[22%]")}>Negative sentiment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.airline} className="border-t border-line transition-colors hover:bg-raised/60">
                    <td className="px-3 py-3.5 font-display text-faint">{i + 1}</td>
                    <td className="px-3 py-3.5">
                      <Link to={`/explorer?airline=${encodeURIComponent(a.airline)}`} className="font-semibold hover:text-accent">{a.airline}</Link>
                      {a.rated_reviews < d.min_sample && <span className="ml-2"><Pill tone="warn" title={`Fewer than ${d.min_sample} rated reviews`}>small sample</Pill></span>}
                    </td>
                    <td className="px-3 py-3.5 text-muted">{a.reviews}</td>
                    <td className="px-3 py-3.5">
                      <div className="mb-1 font-display font-semibold">{a.avg_rating == null ? "n/a" : a.avg_rating.toFixed(2)}</div>
                      <Bar value={a.avg_rating} max={10} color={ratingColor(a.avg_rating ?? 0)} delay={i * 70} />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="mb-1 font-medium">{fmtPct(a.low_rating_pct)}</div>
                      <Bar value={a.low_rating_pct ?? null} max={100} color="#FFB02E" delay={i * 70} />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="mb-1 font-medium">{d.scored ? fmtPct(a.negative_pct) : "not scored"}</div>
                      <Bar value={d.scored ? (a.negative_pct ?? null) : null} max={100} color="#FF6B81" delay={i * 70} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Rise>

      <Rise i={1}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Rating against negativity" subtitle="Each bubble is an airline; bigger means more reviews. Bottom right is the happy corner.">
            {points.length < 2 ? (
              <EmptyState title="Needs scored reviews" text="Score the reviews, with at least two airlines, to see this chart." />
            ) : (
              <ChartBox height={300}>
                <ScatterChart margin={{ top: 16, right: 24, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
                  <XAxis type="number" dataKey="x" name="Average rating" domain={[0, 10]} {...axisProps} label={{ value: "Average rating", position: "insideBottom", offset: -2, fill: "currentColor", fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="Negative share" domain={[0, 100]} unit="%" {...axisProps} />
                  <ZAxis type="number" dataKey="z" range={[110, 520]} />
                  <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3", stroke: "currentColor", strokeOpacity: 0.3 }} />
                  <Scatter data={points} fill="#4FE3C1" fillOpacity={0.75} stroke="#4FE3C1">
                    <LabelList dataKey="airline" position="top" style={{ fill: "currentColor", fontSize: 11 }} />
                  </Scatter>
                </ScatterChart>
              </ChartBox>
            )}
          </Panel>

          <Panel title="Complaint heatmap" subtitle="Mentions of each theme in reviews rated 4 or below, by airline. Keyword matching, so it misses synonyms.">
            {cats.length === 0 ? <EmptyState title="No data" text="No low-rated reviews to analyse." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr><th />{cats.map((c) => <th key={c} className="px-1 pb-1 text-center font-medium text-muted">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {airlines.map((a, ai) => (
                      <tr key={a}>
                        <th className="whitespace-nowrap pr-2 text-right font-medium text-ink">{a}</th>
                        {cats.map((c, ci) => {
                          const m = lookup.get(`${a}|${c}`) ?? 0;
                          const t = m / maxCell;
                          return (
                            <td key={c} className="p-0">
                              <Link
                                to={`/explorer?airline=${encodeURIComponent(a)}&search=${encodeURIComponent(COMPLAINT_SEARCH[c] ?? c)}&max=4`}
                                title={`${a}: ${plural(m, "mention")} of ${c}`}
                                className="cell-in grid h-11 place-items-center rounded-md font-display text-sm font-semibold transition hover:scale-105 hover:ring-2 hover:ring-accent"
                                style={{ animationDelay: `${(ai * cats.length + ci) * 45}ms`, background: m ? `rgba(255,107,129,${0.14 + t * 0.62})` : undefined, color: m ? undefined : "rgb(var(--faint))" }}
                              >
                                {m}
                              </Link>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </Rise>

      <Rise i={2}>
        <Panel title="How management could use this">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Find who to learn from", "Airlines with high ratings and low negative share show what passengers value. Check how many reviews back it."],
              ["Treat negative share as a prompt", "A high share means read the reviews, not that something is proven wrong. Use the heatmap to see where to look."],
              ["Prioritise by theme", "The darkest heatmap cells show which operational area (delays, baggage, service) draws the most complaints for each airline."],
              ["Respect sample size", "Small-sample flags exist for a reason. Revisit the ranking when more reviews arrive."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-xl border border-line bg-raised/60 p-4">
                <Lightbulb size={16} className="text-accent" aria-hidden />
                <p className="mt-2 font-display text-sm font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </div>
            ))}
          </div>
          <Link to="/explorer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">Open the Review Explorer <ArrowRight size={14} aria-hidden /></Link>
        </Panel>
      </Rise>
    </div>
  );
}
