import type { DashboardData } from "./types";

export interface Insight {
  tone: "negative" | "positive" | "info" | "warn";
  title: string;
  body: string;
  action: string;
  to?: string;
  cta?: string;
}

/** Which word to search for when jumping from a complaint theme to the reviews. */
export const COMPLAINT_SEARCH: Record<string, string> = {
  Delays: "delay",
  Baggage: "bag",
  "Customer service": "service",
  Seating: "seat",
  Cleanliness: "dirty",
  Food: "food",
};

/** Plain-English findings, computed only from the numbers on screen. */
export function buildInsights(d: DashboardData): Insight[] {
  const out: Insight[] = [];
  if (!d.kpis.reviews) return out;
  const min = d.min_sample;

  if (d.scored) {
    const eligible = d.airlines.filter((a) => (a.scored_reviews ?? 0) >= min && a.negative_pct != null);
    if (d.airlines.length < 2) {
      /* one airline in view: there is nothing to rank against */
    } else if (eligible.length) {
      const worst = [...eligible].sort((a, b) => (b.negative_pct ?? 0) - (a.negative_pct ?? 0))[0];
      out.push({
        tone: "negative",
        title: `${worst.airline} has the highest negative share`,
        body: `${worst.negative_pct}% of its ${worst.scored_reviews} scored reviews read as negative.`,
        action: "Read those reviews to find the recurring cause before acting on the number.",
        to: `/explorer?airline=${encodeURIComponent(worst.airline)}&sentiment=negative`,
        cta: "Open these reviews",
      });
    } else {
      out.push({
        tone: "warn",
        title: "Too few reviews to rank airlines fairly",
        body: `Rankings need at least ${min} scored reviews per airline, and none qualify in this view.`,
        action: "Loosen the filters or upload a larger file. Percentages from tiny samples mislead.",
      });
    }
  }

  const rated = d.airlines.filter((a) => a.rated_reviews >= min && a.avg_rating != null);
  if (rated.length && d.airlines.length >= 2) {
    const best = [...rated].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))[0];
    out.push({
      tone: "positive",
      title: `${best.airline} is rated highest`,
      body: `Average ${best.avg_rating?.toFixed(2)} out of 10 across ${best.rated_reviews} rated reviews.`,
      action: "Look at what its passengers praise, and check whether weaker airlines could copy it.",
      to: `/explorer?airline=${encodeURIComponent(best.airline)}`,
      cta: "Read its reviews",
    });
  }

  const top = d.complaints[0];
  if (top && top.mentions > 0) {
    out.push({
      tone: "info",
      title: `${top.category} is the most common complaint theme`,
      body: `${top.mentions} mention${top.mentions === 1 ? "" : "s"} among reviews rated 4 or below (keyword match).`,
      action: "Start the operational investigation here, then confirm by reading examples.",
      to: `/explorer?search=${encodeURIComponent(COMPLAINT_SEARCH[top.category] ?? top.category)}&max=4`,
      cta: "See examples",
    });
  }

  const m = d.monthly;
  if (d.scored && m.length >= 2 && m[0].negative_pct != null && m[m.length - 1].negative_pct != null) {
    const a = m[0].negative_pct as number;
    const b = m[m.length - 1].negative_pct as number;
    const diff = b - a;
    out.push({
      tone: diff > 5 ? "negative" : diff < -5 ? "positive" : "info",
      title: Math.abs(diff) <= 5 ? "Negative share is roughly steady" : `Negative share ${diff > 0 ? "rose" : "fell"} over the period`,
      body: `${a}% in ${m[0].month}, ${b}% in ${m[m.length - 1].month}. Monthly counts can be small, so check the volume bars.`,
      action: "A real trend should persist across several months, not one.",
    });
  }
  return out.slice(0, 4);
}
