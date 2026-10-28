import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cx } from "./lib";

export function Panel({
  title, subtitle, action, children, className = "", bodyClass = "",
}: {
  title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={cx("rounded-2xl border border-line bg-panel shadow-panel dark:bg-panel/70 dark:backdrop-blur-xl", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx("p-5", title && "pt-3", bodyClass)}>{children}</div>
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton rounded-xl", className)} />;
}

type Variant = "primary" | "ghost" | "quiet";
export const buttonClass = (variant: Variant = "ghost", extra = "") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "shine bg-accent font-semibold text-accent-ink hover:brightness-110",
    variant === "ghost" && "border border-line bg-panel text-ink hover:bg-raised",
    variant === "quiet" && "text-muted hover:bg-raised hover:text-ink",
    extra,
  );

export function Button({
  variant = "ghost", className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

const TONE: Record<string, string> = {
  positive: "bg-pos/15 text-pos",
  neutral: "bg-neu/15 text-neu",
  negative: "bg-neg/15 text-neg",
  info: "bg-accent/15 text-accent",
  warn: "bg-warn/15 text-warn",
  plain: "bg-raised text-muted",
};
export function Pill({ tone = "plain", children, title }: { tone?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONE[tone] ?? TONE.plain)}>
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label, disabled,
}: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-lg border border-line bg-raised p-0.5", disabled && "pointer-events-none opacity-50")}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-xs font-medium transition",
            value === o.value ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-faint transition focus:border-accent disabled:opacity-50";

export function Field({ label, htmlFor, children, className = "" }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-raised text-faint"><Inbox size={20} aria-hidden /></span>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-neg/30 bg-neg/5 px-6 py-12 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-neg/15 text-neg"><AlertTriangle size={20} aria-hidden /></span>
      <p className="font-display text-sm font-semibold">Could not load data</p>
      <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && <Button variant="primary" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Staggered entrance. Use sparingly: once per page section. */
export function Rise({ i = 0, className = "", children }: { i?: number; className?: string; children: ReactNode }) {
  return <div className={cx("rise", className)} style={{ animationDelay: `${i * 70}ms` }}>{children}</div>;
}
