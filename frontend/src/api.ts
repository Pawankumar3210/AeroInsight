const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError(`Cannot reach the backend at ${BASE}. Is it running?`, 0);
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

export interface QueryResult<R> {
  name: string;
  purpose: string;
  sql: string;
  row_count: number;
  rows: R[];
}

export interface Dataset {
  source: string;
  cleaning_report: {
    rows_in: number;
    rows_kept: number;
    rows_removed: number;
    invalid_ratings_nulled: number;
    missing_or_invalid_dates: number;
  };
  sentiment: null | { method: string | null; scored_rows: number; unscored_rows: number; seconds: number; note: string };
}
