import type { ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 dark:border-white/[0.07] dark:bg-navy-900 ${className}`}
    >
      {title && <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>}
      {children}
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-xl ${className}`} />;
}

/** One cell of the KPI strip. The strip itself is drawn by the page. */
export function Kpi({
  label, value, hint, accent = "text-slate-900 dark:text-white",
}: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="bg-white p-5 dark:bg-navy-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`tnum mt-2 font-display text-3xl font-semibold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
