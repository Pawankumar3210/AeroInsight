import type { Sentiment } from "./types";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const SENT_COLOR: Record<Sentiment, string> = {
  positive: "#34D399",
  neutral: "#8B98B3",
  negative: "#FF6B81",
};

export const fmtPct = (n: number | null | undefined, d = 1) => (n == null ? "n/a" : `${n.toFixed(d)}%`);
export const fmtNum = (n: number) => n.toLocaleString("en-US");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo) - 1] ?? mo} ${y.slice(2)}`;
}

/** Rating colour from coral (low) through amber to green (high). */
export function ratingColor(r: number): string {
  if (r <= 4) return "#FF6B81";
  if (r <= 6) return "#FFB02E";
  if (r <= 8) return "#5EDDB0";
  return "#34D399";
}

export const RATING_BAND = (r: number | null) =>
  r == null ? "No rating" : r >= 7.5 ? "Strong" : r >= 5.5 ? "Mixed" : "Weak";

export const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
