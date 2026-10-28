import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CornerDownLeft, Search } from "lucide-react";
import { cx } from "./lib";

export interface PaletteAction { id: string; label: string; hint: string; Icon: LucideIcon; run: () => void }

/** Ctrl/⌘ + K quick-jump menu. */
export default function Palette({ open, onClose, actions }: { open: boolean; onClose: () => void; actions: PaletteAction[] }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      const t = setTimeout(() => input.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;
  const list = actions.filter((a) => (a.label + " " + a.hint).toLowerCase().includes(q.toLowerCase()));
  const choose = (a?: PaletteAction) => { if (a) { onClose(); a.run(); } };

  return (
    <div className="fade-in fixed inset-0 z-50 grid place-items-start justify-items-center bg-black/55 px-4 pt-[14vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Quick jump"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="pop w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="text-faint" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, list.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") choose(list[idx]);
              else if (e.key === "Escape") onClose();
            }}
            placeholder="Jump to a page or run an action…"
            aria-label="Search actions"
            className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches “{q}”.</li>}
          {list.map((a, i) => (
            <li key={a.id}>
              <button
                onMouseEnter={() => setIdx(i)}
                onClick={() => choose(a)}
                className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", i === idx ? "bg-raised text-ink" : "text-muted")}
              >
                <a.Icon size={16} aria-hidden />
                <span className="flex-1 font-medium">{a.label}</span>
                <span className="text-xs text-faint">{a.hint}</span>
                {i === idx && <CornerDownLeft size={13} className="text-faint" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
