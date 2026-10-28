import { Fragment } from "react";

const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "WITH", "AS", "UNION", "ALL", "CASE", "WHEN", "THEN",
  "ELSE", "END", "AND", "OR", "NOT", "NULL", "IS", "IN", "LIKE", "RLIKE", "DESC", "ASC", "DISTINCT", "OVER", "LIMIT", "BETWEEN",
]);
const FUNCTIONS = new Set(["COUNT", "SUM", "AVG", "ROUND", "CAST", "LOWER", "DATE_FORMAT", "NULLIF", "MIN", "MAX"]);

/** Small SQL highlighter. Colours stay readable in both themes because the block is always dark. */
function tidy(sql: string): string {
  const lines = sql.replace(/\t/g, "  ").split("\n");
  const indent = (l: string) => (l.match(/^ */) as RegExpMatchArray)[0].length;
  const rest = lines.slice(1).filter((l) => l.trim());
  const min = rest.length ? Math.min(...rest.map(indent)) : 0;
  return [lines[0], ...lines.slice(1).map((l) => l.slice(Math.min(min, indent(l))))].join("\n").trim();
}

export function SqlBlock({ sql }: { sql: string }) {
  const parts = tidy(sql).split(/('[^']*'|--[^\n]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]+\b)/g);
  return (
    <pre className="overflow-x-auto rounded-xl border border-white/5 bg-[#070C1B] p-4 text-[12.5px] leading-relaxed text-slate-300">
      <code>
        {parts.map((p, i) => {
          if (!p) return null;
          const up = p.toUpperCase();
          let cls = "";
          if (p.startsWith("--")) cls = "text-slate-500 italic";
          else if (p.startsWith("'")) cls = "text-amber-300";
          else if (/^\d/.test(p)) cls = "text-rose-300";
          else if (KEYWORDS.has(up)) cls = "font-semibold text-emerald-300";
          else if (FUNCTIONS.has(up)) cls = "text-indigo-300";
          return cls ? <span key={i} className={cls}>{p}</span> : <Fragment key={i}>{p}</Fragment>;
        })}
      </code>
    </pre>
  );
}
