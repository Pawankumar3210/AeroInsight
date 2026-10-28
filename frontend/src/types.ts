export type Sentiment = "positive" | "neutral" | "negative";

export interface AirlineRow {
  airline: string;
  reviews: number;
  avg_rating: number | null;
  rated_reviews: number;
  low_rated: number;
  low_rating_pct: number | null;
  scored_reviews?: number;
  negative?: number;
  negative_pct?: number | null;
}
export interface MonthRow {
  month: string;
  reviews: number;
  avg_rating: number | null;
  negative?: number;
  negative_pct?: number | null;
}
export interface DashboardData {
  scored: boolean;
  min_sample: number;
  kpis: { reviews: number; airlines: number; avg_rating: number | null; rated_reviews: number };
  sentiment: { sentiment: Sentiment; reviews: number; pct: number }[];
  airlines: AirlineRow[];
  rating_distribution: { rating: number; reviews: number }[];
  monthly: MonthRow[];
  complaints: { category: string; mentions: number }[];
  options: { airlines: string[]; date_min: string | null; date_max: string | null };
  sql: Record<string, string>;
  cached?: boolean;
  elapsed_ms: number;
}
export interface ReviewRow {
  review: string;
  airline: string;
  rating: number | null;
  date: string | null;
  sentiment?: Sentiment | null;
  sentiment_confidence?: number | null;
  sentiment_method?: string | null;
}
