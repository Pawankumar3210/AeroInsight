import { useSyncExternalStore } from "react";
import type { ReviewRow } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
const NO_BACKEND = BASE === "none"; // used on Vercel: always show the saved snapshot

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------- demo snapshot mode ----------
interface Snapshot {
  captured_at_utc: string;
  dataset: Dataset;
  queries: unknown;
  spark: Record<string, unknown>;
  benchmark: unknown | null;
  dashboard?: unknown;
  predictions?: Record<string, unknown>;
  reviews: ReviewRow[];
}

let demoSince: string | null = null; // set when the snapshot is being shown
const listeners = new Set<() => void>();

/** Returns the snapshot date (text) while demo mode is on, otherwise null. */
export function useDemoMode(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    () => demoSince,
  );
}

let snapPromise: Promise<Snapshot> | null = null;
function loadSnapshot(): Promise<Snapshot> {
  if (!snapPromise) {
    snapPromise = fetch("/demo-snapshot.json")
      .then((r) => {
        if (!r.ok) throw new Error("no snapshot");
        return r.json() as Promise<Snapshot>;
      })
      .catch((e) => {
        snapPromise = null;
        throw e;
      });
  }
  return snapPromise;
}

const out = <T,>(v: unknown) => v as unknown as T;

function demoReviews(snap: Snapshot, query: string) {
  const p = new URLSearchParams(query);
  const search = (p.get("search") ?? "").toLowerCase();
  const airline = p.get("airline") ?? "";
  const sentiment = p.get("sentiment") ?? "";
  const minR = p.get("min_rating");
  const maxR = p.get("max_rating");
  const from = p.get("date_from") ?? "";
  const to = p.get("date_to") ?? "";
  const sort = p.get("sort") ?? "date";
  const dir = (p.get("order") ?? "desc") === "asc" ? 1 : -1;
  const limit = Number(p.get("limit") ?? 25);
  const offset = Number(p.get("offset") ?? 0);

  let rows = snap.reviews.filter((r) => {
    if (search && !r.review.toLowerCase().includes(search)) return false;
    if (airline && r.airline !== airline) return false;
    if (sentiment && r.sentiment !== sentiment) return false;
    if (minR && (r.rating === null || r.rating < Number(minR))) return false;
    if (maxR && (r.rating === null || r.rating > Number(maxR))) return false;
    if (from && (r.date === null || r.date < from)) return false;
    if (to && (r.date === null || r.date > to)) return false;
    return true;
  });

  const key = (r: ReviewRow): string | number | null =>
    sort === "rating" ? r.rating : sort === "airline" ? r.airline : r.date;
  rows = [...rows].sort((a, b) => {
    const va = key(a);
    const vb = key(b);
    if (va === null && vb === null) return a.review.localeCompare(b.review);
    if (va === null) return 1; // missing values last
    if (vb === null) return -1;
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return cmp !== 0 ? cmp * dir : a.review.localeCompare(b.review);
  });
  return { total: rows.length, limit, offset, rows: rows.slice(offset, offset + limit) };
}

async function demoResponse<T>(path: string): Promise<T> {
  const snap = await loadSnapshot();
  const [route, query = ""] = path.split("?");
  if (route === "/api/dataset") return out<T>({ ...snap.dataset, uploads_enabled: false });
  if (route === "/api/queries") return out<T>(snap.queries);
  if (route === "/api/dashboard") {
    if (!snap.dashboard) {
      throw new ApiError("This snapshot is from an older version. Regenerate it with: python -m app.make_snapshot", 404);
    }
    return out<T>(snap.dashboard);
  }
  if (route === "/api/benchmark") {
    if (!snap.benchmark) throw new ApiError("No benchmark in the snapshot.", 404);
    return out<T>(snap.benchmark);
  }
  if (route.startsWith("/api/spark/")) {
    const hit = snap.spark[route.slice("/api/spark/".length)];
    if (!hit) throw new ApiError("That query is not in the snapshot.", 404);
    return out<T>(hit);
  }
  if (route === "/api/reviews") return out<T>(demoReviews(snap, query));
  throw new ApiError("This feature needs the live backend.", 0);
}

/** Saved transformer results for the example reviews, so the snapshot demo can still show a verdict. */
async function demoPredict<T>(init?: RequestInit): Promise<T | null> {
  try {
    const text = (JSON.parse(String(init?.body ?? "{}")) as { text?: string }).text ?? "";
    const snap = await loadSnapshot();
    const hit = snap.predictions?.[text];
    if (!hit) return null;
    if (!demoSince) {
      demoSince = snap.captured_at_utc;
      listeners.forEach((l) => l());
    }
    return out<T>(hit);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isGet = !init || !init.method || init.method === "GET";
  let res: Response;
  try {
    if (NO_BACKEND) throw new Error("no backend configured");
    res = await fetch(BASE + path, init);
  } catch {
    if (!isGet && path === "/api/sentiment/predict") {
      const saved = await demoPredict<T>(init);
      if (saved) return saved;
      throw new ApiError("In this saved snapshot only the four example reviews can be analyzed. Run the live backend to analyze your own text.", 0);
    }
    if (isGet) {
      try {
        const data = await demoResponse<T>(path);
        if (!demoSince) {
          demoSince = (await loadSnapshot()).captured_at_utc;
          listeners.forEach((l) => l());
        }
        return data;
      } catch (e) {
        if (e instanceof ApiError && e.status !== 0) throw e;
      }
    }
    throw new ApiError(
      NO_BACKEND || demoSince
        ? "This feature needs the live backend, which is not connected in this demo snapshot."
        : `Cannot reach the backend at ${BASE}. Is it running?`,
      0,
    );
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

export const API_BASE = BASE;

export async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  return request<T>(path, { method: "POST", body: form });
}

export interface QueryResult<R> {
  name: string;
  purpose: string;
  sql: string;
  row_count: number;
  elapsed_ms?: number;
  rows: R[];
}

export interface Dataset {
  source: string;
  uploads_enabled?: boolean;
  options?: { airlines: string[]; date_min: string | null; date_max: string | null };
  cleaning_report: {
    rows_in: number;
    rows_kept: number;
    rows_removed: number;
    invalid_ratings_nulled: number;
    missing_or_invalid_dates: number;
  };
  sentiment: null | { method: string | null; scored_rows: number; unscored_rows: number; seconds: number; note: string };
}
