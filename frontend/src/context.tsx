import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, get, post, useDemoMode } from "./api";
import type { Dataset } from "./api";

interface Ctx {
  ds: Dataset | null;
  error: string | null;
  /** Bumps whenever the dataset or its scores change, so pages can reload. */
  version: number;
  scoring: boolean;
  scoreError: string | null;
  demo: string | null;
  refresh: () => Promise<void>;
  score: () => Promise<void>;
}

const DatasetCtx = createContext<Ctx | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const demo = useDemoMode();

  const load = useCallback(async (bump: boolean) => {
    try {
      setDs(await get<Dataset>("/api/dataset"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the dataset.");
    }
    if (bump) setVersion((v) => v + 1); // pages reload only when the data really changed
  }, []);
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => { void load(false); }, [load]);

  const score = useCallback(async () => {
    setScoring(true);
    setScoreError(null);
    try {
      await post("/api/sentiment/score");
      await refresh();
    } catch (e) {
      setScoreError(e instanceof ApiError ? e.message : "Scoring failed.");
    } finally {
      setScoring(false);
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ ds, error, version, scoring, scoreError, demo, refresh, score }),
    [ds, error, version, scoring, scoreError, demo, refresh, score],
  );
  return <DatasetCtx.Provider value={value}>{children}</DatasetCtx.Provider>;
}

export function useDataset(): Ctx {
  const c = useContext(DatasetCtx);
  if (!c) throw new Error("useDataset must be used inside DatasetProvider");
  return c;
}
