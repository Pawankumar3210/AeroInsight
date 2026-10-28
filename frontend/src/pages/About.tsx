import { AlertTriangle, BookOpen, Boxes, Database, FileSpreadsheet, Gauge, Layers, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "../Logo";
import { Panel, Rise } from "../ui";

const STEPS = [
  ["Read and clean", "A CSV is read into a PySpark DataFrame. Empty rows and exact duplicates are dropped, and ratings outside 1 to 10 are ignored in averages. Every count is reported."],
  ["Register a view", "The cleaned data becomes a temporary Spark SQL view called “reviews”, cached in memory."],
  ["Score with a transformer", "Each unique review is read by a pretrained sentiment model. The labels and confidences are joined back into the view."],
  ["Ask Spark SQL", "Named SQL queries compute counts, averages, trends and complaint themes. The Spark SQL Insights page shows each query and its live result."],
  ["Serve and display", "FastAPI returns JSON, and this React app draws it. Nothing on screen is typed in by hand."],
];

const STACK: [LucideIcon, string, string][] = [
  [Database, "Apache Spark 3.5 (PySpark)", "Cleaning and every analytical query, run as Spark SQL against a DataFrame view."],
  [Layers, "FastAPI", "A documented JSON API with upload validation, CSV export and a size-limited upload stream."],
  [Gauge, "Transformer sentiment", "A pretrained English model with negative, neutral and positive classes, loaded once and cached."],
  [Boxes, "React, Vite, TypeScript, Tailwind", "A typed interface with a Recharts chart layer, keyboard navigation and both light and dark themes."],
];

const GLOSSARY = [
  ["Negative share", "The percentage of an airline's scored reviews that the model read as negative. It says how often passengers wrote negatively, not why."],
  ["Confidence", "How sure the model is of its label. A confident model can still be wrong, especially on wording it was not trained on."],
  ["Small sample", "Fewer reviews than the minimum set on the backend. Percentages from a handful of reviews swing wildly and should not be used to rank airlines."],
  ["Complaint themes", "Counted by matching keywords in reviews rated 4 or below. A review can count in several themes, and synonyms are missed."],
];

const LIMITS = [
  "The sentiment model was trained on social-media text, not airline reviews, so it can misjudge aviation wording.",
  "Complaint themes use keyword matching, which misses synonyms and misreads negation.",
  "Scoring is capped per run (2,000 unique reviews by default) to protect memory; unscored rows are reported, not hidden.",
  "The backend holds one dataset at a time. An upload replaces it for everyone, and scores are lost when the backend restarts.",
  "The built-in demo file is invented. Nothing here describes real airlines until you load real data you have the right to use.",
  "The Spark versus pandas benchmark ran on one laptop with synthetic data. It does not predict cluster behaviour.",
];

function Card({ Icon, title, text }: { Icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-line bg-raised/60 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent"><Icon size={17} aria-hidden /></span>
      <p className="mt-3 font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}

export default function About() {
  return (
    <div className="space-y-5">
      <Rise i={0}>
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#070C1B] px-7 py-10 text-white sm:px-10">
          <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(700px 260px at 90% 120%, rgba(255,176,46,.26), transparent 62%), radial-gradient(560px 280px at 0% -20%, rgba(79,227,193,.2), transparent 62%)" }} />
          <div className="relative max-w-2xl">
            <Brand size={56} tone="light" />
            <h2 className="mt-6 font-display text-3xl font-semibold leading-tight sm:text-4xl">A Spark SQL approach to passenger sentiment</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              AeroInsight helps airline teams understand what passengers say: how satisfied they are, how airlines compare, what they keep complaining about, and where to look first.
              Spark SQL does the analytics, a pretrained transformer reads the text, and this interface shows how each number was produced.
            </p>
          </div>
        </section>
      </Rise>

      <Rise i={1}>
        <Panel title="How it works">
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {STEPS.map(([t, b], i) => (
              <li key={t} className="rounded-xl border border-line bg-raised/60 p-4">
                <span className="font-display text-2xl font-semibold text-accent">{i + 1}</span>
                <p className="mt-2 font-display text-sm font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </Rise>

      <Rise i={2}>
        <Panel title="What it is built with">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{STACK.map(([I, t, b]) => <Card key={t} Icon={I} title={t} text={b} />)}</div>
        </Panel>
      </Rise>

      <Rise i={3}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="The sentiment model">
            <p className="text-sm leading-relaxed text-muted">
              The default model is <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-ink">cardiffnlp/twitter-roberta-base-sentiment-latest</code> from the Cardiff NLP group, published on Hugging Face.
              It predicts negative, neutral or positive. It was trained on social-media posts, <strong className="text-ink">not on airline reviews</strong>, so treat its labels as a useful signal rather than ground truth.
              Check its model card for training data and license terms.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              If the model cannot load, the backend can use a small word-list fallback. Results always say which method produced them, and the fallback is never presented as the transformer.
            </p>
          </Panel>
          <Panel title="The data">
            <div className="flex gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warn/15 text-warn"><FileSpreadsheet size={17} aria-hidden /></span>
              <p className="text-sm leading-relaxed text-muted">
                The built-in demo file holds a handful of <strong className="text-ink">invented</strong> reviews, there only to show that the pipeline works. It says nothing about real airlines.
                For real analysis, load a CSV you have the right to use with the columns <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-ink">airline, review, rating, date</code>, and record its source and license.
                No website is scraped.
              </p>
            </div>
          </Panel>
        </div>
      </Rise>

      <Rise i={4}>
        <Panel title="Reading the numbers">
          <dl className="grid gap-3 md:grid-cols-2">
            {GLOSSARY.map(([t, b]) => (
              <div key={t} className="rounded-xl border border-line bg-raised/60 p-4">
                <dt className="flex items-center gap-2 font-display text-sm font-semibold"><BookOpen size={14} className="text-accent" aria-hidden />{t}</dt>
                <dd className="mt-1 text-sm text-muted">{b}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </Rise>

      <Rise i={5}>
        <Panel title="Limitations">
          <ul className="space-y-2.5">
            {LIMITS.map((l) => (
              <li key={l} className="flex gap-3 text-sm text-muted"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />{l}</li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-xs text-faint"><ShieldCheck size={13} aria-hidden /> Honest limits are part of the design: the interface labels samples, methods and snapshots instead of hiding them.</p>
        </Panel>
      </Rise>
    </div>
  );
}
