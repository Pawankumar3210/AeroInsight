import { Card } from "../ui";

export default function About() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">About AeroInsight</h1>

      <Card title="What it does">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          AeroInsight analyses airline passenger reviews. Apache Spark SQL does the analytics (counts, averages,
          trends, complaint themes) and a pretrained transformer model classifies each review as positive, neutral
          or negative.
        </p>
      </Card>

      <Card title="Architecture">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>A CSV is read into a PySpark DataFrame, validated and cleaned (empty rows, duplicates and invalid ratings).</li>
          <li>The cleaned data is registered as a temporary Spark SQL view called “reviews”.</li>
          <li>The transformer scores each unique review; the labels are joined back into the view.</li>
          <li>FastAPI endpoints run Spark SQL queries and return the results as JSON.</li>
          <li>This React app (Vite, TypeScript, Tailwind, Recharts) displays the results.</li>
        </ol>
      </Card>

      <Card title="Sentiment model">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Model: <code>cardiffnlp/twitter-roberta-base-sentiment-latest</code> from the Cardiff NLP group, published on
          Hugging Face. It was trained on social-media posts, not airline reviews. See its model card for training data
          and license terms. If the model cannot load, the backend uses a clearly labelled word-list fallback, and
          results always show which method produced them.
        </p>
      </Card>

      <Card title="Data">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The built-in demo file contains a handful of invented reviews, only to show that the pipeline works. It is not
          real research data and says nothing about real airlines. For real analysis, upload a CSV of reviews you have the
          right to use, and record its source and license.
        </p>
      </Card>

      <Card title="Limitations">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>The model can misjudge aviation wording. High confidence does not guarantee a correct label.</li>
          <li>Complaint categories use simple keyword matching, so they miss synonyms and misread negation.</li>
          <li>Scoring is capped per run (2,000 unique reviews by default) to protect memory; unscored rows are reported.</li>
          <li>The backend holds one dataset at a time. An upload replaces it for every user, and scores are lost when the backend restarts.</li>
          <li>Small samples give unreliable percentages, so airlines below the minimum sample size are excluded from rankings.</li>
        </ul>
      </Card>
    </div>
  );
}
