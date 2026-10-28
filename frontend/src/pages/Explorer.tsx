import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, MessageSquareText, RotateCcw, Search, Upload, X } from "lucide-react";
import { API_BASE, ApiError, get, post, upload } from "../api";
import type { Dataset } from "../api";
import { ScoreBanner } from "../components";
import { useDataset } from "../context";
import { SENT_COLOR, cx, plural, ratingColor } from "../lib";
import type { ReviewRow, Sentiment } from "../types";
import { Button, EmptyState, Field, Panel, Pill, Rise, Skeleton, buttonClass, inputCls } from "../ui";

const PAGE = 12;
type SortKey = "date" | "airline" | "rating";
interface Result { total: number; rows: ReviewRow[] }
const RATINGS = Array.from({ length: 10 }, (_, i) => String(i + 1));

function Ring({ value, color }: { value: number; color: string }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="-rotate-90">
      <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="3" />
      <circle cx="11" cy="11" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} />
    </svg>
  );
}

function SentimentCell({ r }: { r: ReviewRow }) {
  if (!r.sentiment) return <span className="text-faint">not scored</span>;
  const conf = r.sentiment_confidence ?? 0;
  return (
    <span className="inline-flex items-center gap-2" title={`${r.sentiment_method ?? ""} · confidence ${(conf * 100).toFixed(0)}%`}>
      <Ring value={conf} color={SENT_COLOR[r.sentiment as Sentiment]} />
      <Pill tone={r.sentiment}>{r.sentiment}</Pill>
    </span>
  );
}

function Drawer({ r, onClose }: { r: ReviewRow; onClose: () => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside
        role="dialog" aria-modal="true" aria-label="Review details"
        onMouseDown={(e) => e.stopPropagation()}
        className="slide-in flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-panel p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold">{r.airline}</p>
            <p className="text-sm text-muted">{r.date ?? "No date"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg border border-line p-2 text-muted hover:bg-raised"><X size={16} aria-hidden /></button>
        </div>
        <blockquote className="mt-6 rounded-xl border border-line bg-raised/60 p-4 text-[15px] leading-relaxed">{r.review}</blockquote>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">Passenger rating</dt>
            <dd className="mt-1.5">
              {r.rating == null ? <span className="text-faint">Missing or invalid</span> : (
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl font-semibold">{r.rating}</span><span className="text-faint">/ 10</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full" style={{ width: `${r.rating * 10}%`, background: ratingColor(r.rating) }} /></div>
                </div>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Model reading</dt>
            <dd className="mt-1.5"><SentimentCell r={r} /></dd>
            {r.sentiment_method && <dd className="mt-1 text-xs text-faint">Method: {r.sentiment_method}. Confidence is not accuracy.</dd>}
          </div>
        </dl>
        <Button variant="primary" className="mt-8" onClick={() => navigate("/analyzer", { state: { text: r.review } })}>
          <MessageSquareText size={15} aria-hidden /> Analyze this review live
        </Button>
      </aside>
    </div>,
    document.body,
  );
}

export default function Explorer() {
  const { ds, version, demo, refresh } = useDataset();
  const [sp] = useSearchParams();
  const [search, setSearch] = useState(sp.get("search") ?? "");
  const [debounced, setDebounced] = useState(sp.get("search") ?? "");
  const [airline, setAirline] = useState(sp.get("airline") ?? "");
  const [sentiment, setSentiment] = useState(sp.get("sentiment") ?? "");
  const [minRating, setMinRating] = useState(sp.get("min") ?? "");
  const [maxRating, setMaxRating] = useState(sp.get("max") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<ReviewRow | null>(null);

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
    p.set("sort", sort); p.set("order", order); p.set("limit", String(PAGE)); p.set("offset", String(page * PAGE));
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
  const clear = () => {
    setSearch(""); setDebounced(""); setAirline(""); setSentiment("");
    setMinRating(""); setMaxRating(""); setDateFrom(""); setDateTo(""); setPage(0);
  };
  const activeFilters = [debounced, airline, sentiment, minRating, maxRating, dateFrom, dateTo].filter(Boolean).length;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const r = await upload<{ source: string; cleaning_report: Dataset["cleaning_report"] }>("/api/upload", f);
      const c = r.cleaning_report;
      setMsg({ ok: true, text: `${r.source}: ${c.rows_kept} of ${c.rows_in} rows kept (${c.rows_removed} removed, ${c.invalid_ratings_nulled} invalid ratings ignored). Score the reviews to see sentiment.` });
      clear();
      await refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Upload failed." });
    } finally { setBusy(false); input.value = ""; }
  }
  async function resetDemo() {
    setBusy(true); setMsg(null);
    try {
      await post("/api/reset");
      clear();
      await refresh();
      setMsg({ ok: true, text: "Demo data restored." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Reset failed." });
    } finally { setBusy(false); }
  }

  const airlines = ds?.options?.airlines ?? [];
  const scored = !!ds?.sentiment;
  const uploadsOn = ds?.uploads_enabled !== false && !demo;
  const pages = res ? Math.max(1, Math.ceil(res.total / PAGE)) : 1;
  const SortBtn = ({ k, children }: { k: SortKey; children: string }) => (
    <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-ink">
      {children}{k === sort && (order === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
    </button>
  );
  const th = "px-4 py-3 text-left text-xs font-medium text-muted";

  return (
    <div className="space-y-5">
      {ds && !scored && <ScoreBanner compact />}

      <Rise i={0}>
        <Panel bodyClass="!p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <Field label="Search review text" htmlFor="f-search" className="lg:col-span-4">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
                <input id="f-search" className={cx(inputCls, "pl-9")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. delay, baggage, rude" />
              </div>
            </Field>
            <Field label="Airline" htmlFor="f-airline" className="lg:col-span-2">
              <select id="f-airline" className={inputCls} value={airline} onChange={(e) => { setAirline(e.target.value); setPage(0); }}>
                <option value="">All airlines</option>{airlines.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Sentiment" htmlFor="f-sent" className="lg:col-span-2">
              <select id="f-sent" className={inputCls} value={sentiment} disabled={!scored} onChange={(e) => { setSentiment(e.target.value); setPage(0); }}>
                <option value="">{scored ? "Any sentiment" : "Score first"}</option>
                <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
              </select>
            </Field>
            <Field label="Min rating" htmlFor="f-min" className="lg:col-span-2">
              <select id="f-min" className={inputCls} value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(0); }}>
                <option value="">Any</option>{RATINGS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Max rating" htmlFor="f-max" className="lg:col-span-2">
              <select id="f-max" className={inputCls} value={maxRating} onChange={(e) => { setMaxRating(e.target.value); setPage(0); }}>
                <option value="">Any</option>{RATINGS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Date from" htmlFor="f-from" className="lg:col-span-3">
              <input id="f-from" type="date" className={inputCls} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
            </Field>
            <Field label="Date to" htmlFor="f-to" className="lg:col-span-3">
              <input id="f-to" type="date" className={inputCls} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
              <Button variant="quiet" onClick={clear} disabled={!activeFilters}><RotateCcw size={14} aria-hidden /> Clear{activeFilters ? ` (${activeFilters})` : ""}</Button>
              {!demo && <a className={buttonClass("ghost")} href={`${API_BASE}/api/export?${filterParams().toString()}`}><Download size={14} aria-hidden /> Download CSV</a>}
              {uploadsOn && (
                <>
                  <label className={cx(buttonClass("primary"), "cursor-pointer", busy && "pointer-events-none opacity-50")}>
                    <Upload size={14} aria-hidden /> {busy ? "Working…" : "Upload CSV"}
                    <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={onUpload} />
                  </label>
                  <Button onClick={resetDemo} disabled={busy}>Restore demo</Button>
                </>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-faint">
            {demo
              ? "Searching the saved snapshot in your browser. Upload and CSV download need the live backend."
              : uploadsOn
                ? "Upload needs columns airline, review, rating (1 to 10) and date (YYYY-MM-DD). It replaces the dataset for everyone using this backend."
                : "Uploads are turned off on this server because one shared dataset would change for every visitor. Run the project locally to analyse your own CSV."}
          </p>
          {msg && <p role={msg.ok ? "status" : "alert"} className={cx("mt-2 text-sm", msg.ok ? "text-pos" : "text-neg")}>{msg.text}</p>}
        </Panel>
      </Rise>

      <Rise i={1}>
        <Panel bodyClass="!p-0" className="overflow-hidden">
          {error && <p role="alert" className="border-b border-line px-5 py-3 text-sm text-neg">{error}</p>}
          <div className={cx("overflow-x-auto transition-opacity", loading && res && "opacity-60")} aria-busy={loading}>
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-line bg-raised/50">
                <tr>
                  <th className={th} aria-sort={sort === "airline" ? (order === "asc" ? "ascending" : "descending") : "none"}><SortBtn k="airline">Airline</SortBtn></th>
                  <th className={th} aria-sort={sort === "date" ? (order === "asc" ? "ascending" : "descending") : "none"}><SortBtn k="date">Date</SortBtn></th>
                  <th className={th} aria-sort={sort === "rating" ? (order === "asc" ? "ascending" : "descending") : "none"}><SortBtn k="rating">Rating</SortBtn></th>
                  <th className={th}>Sentiment</th>
                  <th className={th}>Review</th>
                </tr>
              </thead>
              <tbody>
                {!res && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-line"><td colSpan={5} className="px-4 py-3"><Skeleton className="h-6" /></td></tr>
                ))}
                {res?.rows.map((r, i) => (
                  <tr
                    key={`${r.airline}-${r.date}-${i}`} tabIndex={0} onClick={() => setOpen(r)}
                    onKeyDown={(e) => { if (e.key === "Enter") setOpen(r); }}
                    className="cursor-pointer border-t border-line align-middle transition-colors hover:bg-raised/70 focus-visible:bg-raised/70"
                  >
                    <td className="px-4 py-3.5 text-sm font-semibold">{r.airline}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted">{r.date ?? "n/a"}</td>
                    <td className="px-4 py-3.5">
                      {r.rating == null ? <span className="text-sm text-faint">n/a</span> : (
                        <span className="inline-flex items-center gap-2 text-sm font-medium">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ratingColor(r.rating) }} aria-hidden />{r.rating}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><SentimentCell r={r} /></td>
                    <td className="max-w-[28rem] px-4 py-3.5 text-sm text-muted"><span className="line-clamp-2">{r.review}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res && res.rows.length === 0 && !loading && (
            <EmptyState title="No reviews match" text="Try removing a filter or searching for a shorter word." action={<Button onClick={clear}>Clear filters</Button>} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">{res ? `${plural(res.total, "review")} match` : "Loading…"} · click a row for details</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={15} aria-hidden /></Button>
              <span className="tabular-nums text-muted">Page {page + 1} of {pages}</span>
              <Button variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={15} aria-hidden /></Button>
            </div>
          </div>
        </Panel>
      </Rise>

      {open && <Drawer r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
