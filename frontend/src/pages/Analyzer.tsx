import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { LogoMark } from "../Logo";
import { ApiError, post } from "../api";
import { useDataset } from "../context";
import { SENT_COLOR, cx } from "../lib";
import type { Sentiment } from "../types";
import { Button, EmptyState, Panel, Pill, Rise } from "../ui";

interface Pred {
  label: Sentiment;
  confidence: number;
  scores: Record<string, number> | null;
  method: string;
  model: string | null;
  note: string;
}
interface Past { text: string; pred: Pred }

const EXAMPLES = [
  "The flight was delayed three hours and the staff were rude.",
  "Lovely crew, comfortable seats, would fly again.",
  "The flight departed at 9am and landed at 11am.",
  "Lost my bags, and customer service blamed me for it.",
];

function Barcode({ seed }: { seed: string }) {
  let x = 2166136261;
  for (const ch of seed) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); }
  x >>>= 0;
  const bars: { x: number; w: number }[] = [];
  let pos = 0;
  for (let i = 0; i < 38; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const w = 1 + (x >>> 28) % 3;
    if (i % 2 === 0) bars.push({ x: pos, w });
    pos += w + 1;
  }
  return (
    <div className="relative mx-auto h-[34px] w-[148px]">
      <svg width="148" height="34" viewBox={`0 0 ${pos} 34`} preserveAspectRatio="none" aria-hidden className="text-ink opacity-80">
        {bars.map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height="34" fill="currentColor" />)}
      </svg>
      <span aria-hidden className="laser absolute inset-y-[-3px] left-0 w-[2px] bg-accent shadow-[0_0_10px_2px_rgb(var(--accent)/0.8)]" />
    </div>
  );
}

function ConfidenceRing({ value, color }: { value: number; color: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} style={{ transition: "stroke-dasharray .8s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-2xl font-semibold leading-none">{Math.round(value * 100)}<span className="text-sm text-muted">%</span></p>
          <p className="mt-1 text-[10px] text-muted">confidence</p>
        </div>
      </div>
    </div>
  );
}

function BoardingPass({ pred, text }: { pred: Pred; text: string }) {
  const color = SENT_COLOR[pred.label];
  const transformer = pred.method === "transformer";
  const notch = "absolute h-6 w-6 rounded-full border border-line bg-canvas";
  return (
    <div className="pass-in relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-panel sm:flex-row">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} aria-hidden />
      <div className="flex-1 p-6 pt-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"><LogoMark size={16} /> Sentiment boarding pass</p>
          <Pill tone={transformer ? "info" : "warn"} title={pred.model ?? undefined}>{transformer ? "Read by transformer" : "Word-list fallback"}</Pill>
        </div>
        <p className="mt-5 text-xs font-medium text-muted">Passenger voice</p>
        <p className="mt-1 line-clamp-3 text-[15px] leading-relaxed">“{text}”</p>
        <p className="mt-6 text-xs font-medium text-muted">Verdict</p>
        <p key={pred.label + pred.confidence} className="stamp inline-block font-display text-5xl font-semibold uppercase leading-none tracking-tight" style={{ color, textShadow: `0 0 28px ${color}55` }}>{pred.label}</p>
        {pred.scores && (
          <div className="mt-6 space-y-2.5">
            {(["positive", "neutral", "negative"] as Sentiment[]).map((k) => (
              <div key={k} className="flex items-center gap-3 text-sm">
                <span className="w-16 capitalize text-muted">{k}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                  <div className="grow-x h-full rounded-full" style={{ width: `${(pred.scores?.[k] ?? 0) * 100}%`, background: SENT_COLOR[k] }} />
                </div>
                <span className="w-14 text-right tabular-nums">{((pred.scores?.[k] ?? 0) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="relative border-dashed border-line max-sm:border-t-2 sm:border-l-2" aria-hidden>
        <span className={cx(notch, "max-sm:-left-3 max-sm:-top-3 sm:-left-3 sm:-top-3")} />
        <span className={cx(notch, "max-sm:-right-3 max-sm:-top-3 sm:-bottom-3 sm:-left-3")} />
      </div>
      <div className="flex flex-col items-center justify-between gap-5 p-6 sm:w-52">
        <ConfidenceRing value={pred.confidence} color={color} />
        <div className="text-center">
          <Barcode seed={text + pred.label} />
          <p className="mt-1.5 text-[10px] text-faint">{pred.model ? pred.model.split("/").pop() : "heuristic score"}</p>
        </div>
      </div>
    </div>
  );
}

export default function Analyzer() {
  const { demo } = useDataset();
  const location = useLocation();
  const incoming = (location.state as { text?: string } | null)?.text ?? "";
  const [text, setText] = useState(incoming);
  const [shown, setShown] = useState("");
  const [pred, setPred] = useState<Pred | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Past[]>([]);
  const auto = useRef(false);

  const run = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const p = await post<Pred>("/api/sentiment/predict", { text: value });
      setPred(p);
      setShown(value);
      setHistory((h) => [{ text: value, pred: p }, ...h.filter((x) => x.text !== value)].slice(0, 5));
    } catch (e) {
      setPred(null);
      setError(e instanceof ApiError ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (incoming && !auto.current) { auto.current = true; void run(incoming); }
  }, [incoming, run]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-5">
        <Rise i={0} className="lg:col-span-2">
          <Panel title="Passenger review" subtitle="Type or paste any review. The model runs on the server.">
            <form onSubmit={(e) => { e.preventDefault(); void run(text); }}>
              <label htmlFor="review-text" className="sr-only">Passenger review</label>
              <div className={cx("scanbox", busy && "on")}>
                <textarea
                  id="review-text" rows={7} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Lost my bags and the staff were rude"
                  className="w-full resize-none rounded-xl border border-line bg-raised p-3.5 text-sm leading-relaxed placeholder:text-faint focus:border-accent"
                />
              </div>
              <div className="mt-1 text-right text-[11px] text-faint">{text.length} / 5000</div>
              <Button type="submit" variant="primary" className="mt-2 w-full" disabled={busy || !text.trim()}>
                {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Reading…</> : <><Send size={14} aria-hidden /> Analyze sentiment</>}
              </Button>
              {busy && <p className="mt-2 text-xs text-muted">The first request after the backend starts can take a while while the model loads.</p>}
              {demo && <p className="mt-2 text-xs text-warn">Saved snapshot: only the example reviews below can be analyzed here. Run the live backend to analyze your own text.</p>}
            </form>
            <p className="mb-2 mt-5 text-xs font-medium text-muted">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button key={i} type="button" onClick={() => { setText(ex); void run(ex); }} className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-muted transition hover:border-accent hover:text-ink">
                  {ex.length > 34 ? ex.slice(0, 32) + "…" : ex}
                </button>
              ))}
            </div>
          </Panel>
        </Rise>

        <Rise i={1} className="lg:col-span-3">
          {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-neg/30 bg-neg/10 p-3 text-sm text-neg"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{error}</p>}
          {pred ? (
            <div className="space-y-4">
              <BoardingPass pred={pred} text={shown} />
              {pred.method !== "transformer" && (
                <p role="alert" className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
                  This result did <strong>not</strong> come from the transformer. It comes from a simple word-list fallback that ignores context and negation, and its “confidence” is a rough heuristic, not a probability.
                </p>
              )}
              <p className="px-1 text-xs leading-relaxed text-muted">{pred.note}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line">
              <EmptyState title="Your boarding pass appears here" text="Analyze a review to see the verdict, the confidence, and how the model weighed each sentiment." />
            </div>
          )}
        </Rise>
      </div>

      {history.length > 0 && (
        <Rise i={2}>
          <Panel title="This session" subtitle="Click one to show it again">
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.text}>
                  <button onClick={() => { setText(h.text); setShown(h.text); setPred(h.pred); }} className="flex w-full items-center gap-3 py-2.5 text-left text-sm transition hover:text-accent">
                    <Pill tone={h.pred.label}>{h.pred.label}</Pill>
                    <span className="flex-1 truncate text-muted">{h.text}</span>
                    <span className="tabular-nums text-xs text-faint">{Math.round(h.pred.confidence * 100)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </Rise>
      )}
    </div>
  );
}
