import { useCallback, useEffect, useState } from "react";
import { API_BASE, ApiError, get, post, upload } from "../api";
import type { Dataset, QueryResult } from "../api";
import { Badge, ScoreNotice } from "../components";
import { Card } from "../ui";

const PAGE = 15;
type SortKey = "date" | "airline" | "rating";
interface Row {
  review: string; airline: string; rating: number | null; date: string | null;
  sentiment?: string | null; sentiment_confidence?: number | null; sentiment_method?: string | null;
}
interface Result { total: number; rows: Row[] }

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-navy-900";

export default function Explorer() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [airlines, setAirlines] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [airline, setAirline] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // dataset info + airline list (reloaded after upload / scoring)
  useEffect(() => {
    get<Dataset>("/api/dataset").then(setDs).catch(() => setDs(null));
    get<QueryResult<{ airline: string }>>("/api/spark/reviews_by_airline")
      .then((r) => setAirlines(r.rows.map((x) => x.airline).sort()))
      .catch(() => setAirlines([]));
  }, [version]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("search", debounced);
    if (airline) p.set("airline", airline);
    if (sentiment) p.set("sentiment", sentiment);
    if (minRating) p.set("min_rating", minRating);
    if (maxRating) p.set("max_rating", maxRating);
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    return p;
  }, [debounced, airline, sentiment, minRating, maxRating, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = filterParams();
    p.set("sort", sort);
    p.set("order", order);
    p.set("limit", String(PAGE));
    p.set("offset", String(page * PAGE));
    get<Result>("/api/reviews?" + p.toString())
      .then((r) => { if (!cancelled) { setRes(r); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load reviews."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filterParams, sort, order, page, version]);

  function toggleSort(k: SortKey) {
    if (k === sort) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(k); setOrder(k === "airline" ? "asc" : "desc"); }
    setPage(0);
  }

  function clearFilters() {
    setSearch(""); setDebounced(""); setAirline(""); setSentiment("");
    setMinRating(""); setMaxRating(""); setDateFrom(""); setDateTo(""); setPage(0);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await upload<{ source: string; cleaning_report: Dataset["cleaning_report"] }>("/api/upload", f);
      const c = r.cleaning_report;
      setMsg({ ok: true, text: `${r.source}: ${c.rows_kept} of ${c.rows_in} rows kept (${c.rows_removed} removed, ${c.invalid_ratings_nulled} invalid ratings ignored). Score the reviews to see sentiment.` });
      clearFilters();
      setVersion((v) => v + 1);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  async function resetDemo() {
    setBusy(true);
    setMsg(null);
    try {
      await post("/api/reset");
      clearFilters();
      setVersion((v) => v + 1);
      setMsg({ ok: true, text: "Demo data restored." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Reset failed." });
    } finally {
      setBusy(false);
    }
  }

  const scored = !!ds?.sentiment;
  const pages = res ? Math.max(1, Math.ceil(res.total / PAGE)) : 1;
  const arrow = (k: SortKey) => (k === sort ? (order === "asc" ? " ▲" : " ▼") : "");
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Review explorer</h1>
      {ds && <p className="text-sm text-slate-500 dark:text-slate-400">{ds.source}</p>}
      {ds && !scored && <ScoreNotice onDone={() => setVersion((v) => v + 1)} />}

      <Card title="Data">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
            {busy ? "Working…" : "Upload CSV"}
            <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={onUpload} />
          </label>
          <button onClick={resetDemo} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-white/20">
            Restore demo data
          </button>
          <a
            href={`${API_BASE}/api/export?${filterParams().toString()}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-white/20"
          >
            Download filtered CSV
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Required columns: airline, review, rating (1–10), date (YYYY-MM-DD). Uploading replaces the dataset on the
          backend for everyone using it. The download contains the reviews matching the filters below, plus sentiment if scored.
        </p>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-emerald-500" : "text-rose-500"}`}>
            {msg.text}
          </p>
        )}
      </Card>

      <Card title="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="f-search" className="mb-1 block text-xs text-slate-500">Search review text</label>
            <input id="f-search" className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. delay, baggage" />
          </div>
          <div>
            <label htmlFor="f-airline" className="mb-1 block text-xs text-slate-500">Airline</label>
            <select id="f-airline" className={field} value={airline} onChange={(e) => { setAirline(e.target.value); setPage(0); }}>
              <option value="">All airlines</option>
              {airlines.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-sent" className="mb-1 block text-xs text-slate-500">Sentiment</label>
            <select id="f-sent" className={field} value={sentiment} disabled={!scored} onChange={(e) => { setSentiment(e.target.value); setPage(0); }}>
              <option value="">{scored ? "Any sentiment" : "Score reviews first"}</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-min" className="mb-1 block text-xs text-slate-500">Min rating</label>
            <input id="f-min" type="number" min={1} max={10} className={field} value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label htmlFor="f-max" className="mb-1 block text-xs text-slate-500">Max rating</label>
            <input id="f-max" type="number" min={1} max={10} className={field} value={maxRating} onChange={(e) => { setMaxRating(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label htmlFor="f-from" className="mb-1 block text-xs text-slate-500">Date from</label>
            <input id="f-from" type="date" className={field} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label htmlFor="f-to" className="mb-1 block text-xs text-slate-500">Date to</label>
            <input id="f-to" type="date" className={field} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
          </div>
        </div>
        <button onClick={clearFilters} className="mt-3 text-sm text-sky-500 hover:underline">Clear filters</button>
      </Card>

      <Card>
        {error && <p role="alert" className="mb-3 text-sm text-rose-500">{error}</p>}
        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                {(["airline", "date", "rating"] as SortKey[]).map((k) => (
                  <th key={k} className={th} aria-sort={k === sort ? (order === "asc" ? "ascending" : "descending") : "none"}>
                    <button onClick={() => toggleSort(k)} className="uppercase">{k}{arrow(k)}</button>
                  </th>
                ))}
                <th className={th}>Sentiment</th>
                <th className={th}>Review</th>
              </tr>
            </thead>
            <tbody>
              {res?.rows.map((r, i) => (
                <tr key={`${r.airline}-${r.date}-${i}`} className="border-t border-slate-200 align-top dark:border-white/10">
                  <td className="px-3 py-2 text-sm font-medium">{r.airline}</td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">{r.date ?? "n/a"}</td>
                  <td className="px-3 py-2 text-sm">{r.rating ?? "n/a"}</td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {r.sentiment ? (
                      <Badge tone={r.sentiment} title={`Method: ${r.sentiment_method}`}>
                        {r.sentiment} {Math.round((r.sentiment_confidence ?? 0) * 100)}%
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-sm">{r.review}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {res && res.rows.length === 0 && !loading && (
          <p className="py-6 text-center text-sm text-slate-500">No reviews match these filters.</p>
        )}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">{res ? `${res.total} matching reviews` : "Loading…"}</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-white/20">Previous</button>
            <span>Page {page + 1} of {pages}</span>
            <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-white/20">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
