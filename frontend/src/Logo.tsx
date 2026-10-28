import { useId } from "react";
import { cx } from "./lib";

/** AeroInsight mark: a faceted delta (an "A" and an aircraft) inside an orbit, with an amber beacon. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const small = size < 28; // below this size the orbit ring turns to noise, so it is dropped
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={cx("shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16294F" />
          <stop offset="1" stopColor="#070C1B" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8BF7DF" />
          <stop offset="1" stopColor="#2FC4AB" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#58A6FF" />
          <stop offset="1" stopColor="#2B64E0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx={small ? 12 : 13} fill={`url(#${id}t)`} />
      {!small && (
        <>
          <rect x=".5" y=".5" width="47" height="47" rx="12.5" fill="none" stroke="#fff" strokeOpacity=".14" />
          <g transform="rotate(-28 24 25)">
            <ellipse cx="24" cy="25" rx="19.5" ry="7.4" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.2" />
          </g>
        </>
      )}
      <polygon points={small ? "23,6 23,31 6.5,42" : "24,7.5 24,30.5 10,39.5"} fill={`url(#${id}l)`} />
      <polygon points={small ? "23,6 39.5,42 23,31" : "24,7.5 38,39.5 24,30.5"} fill={`url(#${id}r)`} />
      <circle cx={small ? 39 : 41.2} cy={small ? 11 : 15.8} r={small ? 4.4 : 3} fill="#FFB02E" />
    </svg>
  );
}

/** "AeroInsight" set in two weights. tone="light" is for always-dark surfaces such as the sidebar. */
export function Wordmark({ tone = "auto", className = "" }: { tone?: "auto" | "light"; className?: string }) {
  const base = tone === "light" ? "text-white" : "text-ink";
  const accent = tone === "light" ? "text-[#4FE3C1]" : "text-accent";
  return (
    <span className={cx("font-display text-[18px] font-semibold leading-none tracking-tight", base, className)}>
      Aero<span className={cx("font-light", accent)}>Insight</span>
    </span>
  );
}

export function Brand({ size = 40, tone = "auto", className = "" }: { size?: number; tone?: "auto" | "light"; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <LogoMark size={size} />
      <Wordmark tone={tone} className={size >= 48 ? "!text-[26px]" : ""} />
    </span>
  );
}
