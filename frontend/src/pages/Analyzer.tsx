import { useState } from "react";
import { ApiError, post } from "../api";
import { Badge } from "../components";
import { Card } from "../ui";

interface Pred {
  label: "positive" | "neutral" | "negative";
  confidence: number;
  scores: Record<string, number> | null;
  method: string;
  model: string | null;
  note: string;
}

const EXAMPLES = [
  "The flight was delayed three hours and the staff were rude.",
  "Lovely crew, comfortable seats, would fly again.",
  "The flight departed at 9am and landed at 11am.",
];
const BAR: Record<string, string> = { positive: "bg-emerald-500", neutral: "bg-slate-400", negative: "bg-rose-500" };

export default function Analyzer() {
  const [text, setText] = useState("");
  const [pred, setPred] = useState<Pred | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setPred(await post<Pred>("/api/sentiment/predict", { text }));
    } catch (err) {
      setPred(null);
      setError(err instanceof ApiError ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  const isTransformer = pred?.method === "transformer";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Live sentiment analyzer</h1>
      <Card>
        <form onSubmit={analyze}>
          <label htmlFor="review-text" className="mb-1 block text-sm font-medium">Paste or type a passenger review</label>
          <textarea
            id="review-text"
            rows={5}
            maxLength={5000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-white/20 dark:bg-navy-900"
            placeholder="e.g. Lost my bags and the staff were rude"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || !text.trim()} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60">
              {busy ? "Analyzing…" : "Analyze sentiment"}
            </button>
            <span className="text-xs text-slate-500">Try:</span>
            {EXAMPLES.map((ex, i) => (
              <button key={i} type="button" onClick={() => setText(ex)} className="rounded-full border border-slate-300 px-3 py-1 text-xs dark:border-white/20">
                Example {i + 1}
              </button>
            ))}
          </div>
          {busy && <p className="mt-2 text-xs text-slate-500">The first request after the backend starts can take a while because the model loads into memory.</p>}
        </form>
      </Card>

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</p>}

      {pred && (
        <Card title="Result">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={pred.label}>{pred.label.toUpperCase()}</Badge>
            <span className="text-sm">Confidence: <strong>{(pred.confidence * 100).toFixed(1)}%</strong></span>
            <Badge tone={isTransformer ? "info" : "warn"} title={pred.model ?? undefined}>
              {isTransformer ? "Method: transformer" : "Method: fallback word list"}
            </Badge>
          </div>

          {!isTransformer && (
            <p role="alert" className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              This result did NOT come from the transformer model. It comes from a simple word-list fallback, which
              ignores context and negation, and its “confidence” is a rough heuristic, not a probability.
            </p>
          )}

          {pred.scores && (
            <div className="mt-4 space-y-2">
              {Object.entries(pred.scores).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-20 capitalize">{k}</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-white/10">
                    <div className={`h-2 rounded-full ${BAR[k] ?? "bg-sky-500"}`} style={{ width: `${v * 100}%` }} />
                  </div>
                  <span className="w-14 text-right tabular-nums">{(v * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
          {pred.model && <p className="mt-3 text-xs text-slate-500">Model: {pred.model}</p>}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{pred.note}</p>
        </Card>
      )}
    </div>
  );
}
