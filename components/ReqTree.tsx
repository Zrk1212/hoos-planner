"use client";
/**
 * Building blocks for the Requirements page (Stellic-style audit): status icons, progress ring and bar,
 * requirement rows with course chips, collapsible program sections and warning callouts.
 */
import { useState } from "react";
import type { ItemStatus } from "@/lib/requirements";

export const STATUS_COLOR: Record<ItemStatus, string> = {
  done: "var(--ok)",
  in_progress: "var(--accent)",
  planned: "var(--orange)",
  missing: "var(--line)",
};
export const STATUS_TEXT: Record<ItemStatus, string> = {
  done: "Satisfied",
  in_progress: "In progress",
  planned: "Planned",
  missing: "Not started",
};

export function StatusIcon({ status, size = 20 }: { status: ItemStatus; size?: number }) {
  const label = STATUS_TEXT[status];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={label} className="shrink-0">
      {status === "done" && (
        <>
          <circle cx="10" cy="10" r="9" fill="var(--ok)" />
          <path d="M5.8 10.3l2.7 2.7 5.7-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {status === "in_progress" && (
        <>
          <circle cx="10" cy="10" r="8.2" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
          <path d="M10 3.6a6.4 6.4 0 0 1 0 12.8z" fill="var(--accent)" />
        </>
      )}
      {status === "planned" && (
        <>
          <circle cx="10" cy="10" r="8.2" fill="color-mix(in oklab, var(--orange) 12%, transparent)" stroke="var(--orange)" strokeWidth="1.8" strokeDasharray="3 2.2" />
          <circle cx="10" cy="10" r="2.4" fill="var(--orange)" />
        </>
      )}
      {status === "missing" && <circle cx="10" cy="10" r="8.2" fill="none" stroke="color-mix(in oklab, var(--muted) 55%, transparent)" strokeWidth="1.8" />}
    </svg>
  );
}

export interface Tally { done: number; in_progress: number; planned: number; missing: number }
export const tally = (ss: ItemStatus[]): Tally => {
  const t: Tally = { done: 0, in_progress: 0, planned: 0, missing: 0 };
  for (const s of ss) t[s]++;
  return t;
};
const total = (t: Tally) => t.done + t.in_progress + t.planned + t.missing;

/** Ring with done / in-progress / planned arcs, like Stellic's colored progress circle. */
export function ProgressRing({ t, size = 76 }: { t: Tally; size?: number }) {
  const n = Math.max(1, total(t));
  const r = 30, c = 2 * Math.PI * r;
  let acc = 0;
  const arcs = (["done", "in_progress", "planned"] as const).map((k) => {
    const len = (t[k] / n) * c;
    const arc = { k, len, off: acc };
    acc += len;
    return arc;
  });
  const pct = Math.round((t.done / n) * 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 76 76" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--chip)" strokeWidth="8" />
        {arcs.map((a) => a.len > 0 && (
          <circle key={a.k} cx="38" cy="38" r={r} fill="none" stroke={STATUS_COLOR[a.k]} strokeWidth="8"
            strokeDasharray={`${Math.max(0, a.len - 1.2)} ${c}`} strokeDashoffset={-a.off}
            style={{ transition: "stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1), stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)" }} />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div className="mono text-[15px] font-semibold leading-none">{pct}%</div>
      </div>
    </div>
  );
}

/** Thin stacked bar with the same segments. */
export function ProgressBar({ t }: { t: Tally }) {
  const n = Math.max(1, total(t));
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-chip" aria-hidden>
      {(["done", "in_progress", "planned"] as const).map((k) => (
        <div key={k} style={{ width: `${(t[k] / n) * 100}%`, background: STATUS_COLOR[k], transition: "width 700ms cubic-bezier(.2,.8,.2,1)" }} />
      ))}
    </div>
  );
}

export function Legend({ t }: { t: Tally }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      {(["done", "in_progress", "planned", "missing"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: k === "missing" ? "color-mix(in oklab, var(--muted) 40%, transparent)" : STATUS_COLOR[k] }} />
          <span className="mono text-ink">{t[k]}</span> {STATUS_TEXT[k].toLowerCase()}
        </span>
      ))}
    </div>
  );
}

export interface ChipSpec { code: string; cart: boolean; fresh: boolean; status: ItemStatus }

export function CourseChip({ chip, term }: { chip: ChipSpec; term: string }) {
  const tone = chip.cart
    ? "border-dashed text-orange-ink"
    : chip.status === "done" ? "text-ink" : chip.status === "in_progress" ? "text-accent" : "text-muted";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${tone} ${chip.fresh ? "block-arrive" : ""}`}
      style={{
        borderColor: chip.cart ? "color-mix(in oklab, var(--orange) 60%, transparent)" : "var(--line)",
        background: chip.cart ? "color-mix(in oklab, var(--orange) 9%, var(--glass-fill-strong))" : "var(--chip)",
      }}
    >
      <span className="mono truncate">{chip.code}</span>
      {chip.cart && <span className="whitespace-nowrap rounded-full px-1.5 text-[10px] font-semibold" style={{ background: "color-mix(in oklab, var(--orange) 18%, transparent)" }}>{term}</span>}
    </span>
  );
}

export function ReqRow({ status, label, sub, chips, text, hint, term, changed }: {
  status: ItemStatus; label: string; sub?: string; chips: ChipSpec[]; text?: string; hint?: string; term: string; changed?: boolean;
}) {
  return (
    <li className={`flex items-start gap-3 rounded-xl px-2.5 py-2.5 sm:px-3 ${changed ? "block-arrive" : ""}`}
      style={changed ? { background: "color-mix(in oklab, var(--accent) 7%, transparent)" } : undefined}>
      <div className="pt-0.5"><StatusIcon status={status} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[14px] font-medium">{label}</span>
            {sub && <span className="ml-1.5 text-xs text-muted">{sub}</span>}
          </div>
          <span className="shrink-0 text-[11px] font-medium whitespace-nowrap" style={{ color: status === "missing" ? "var(--muted)" : status === "planned" ? "var(--orange-ink)" : STATUS_COLOR[status] }}>
            {STATUS_TEXT[status]}
          </span>
        </div>
        {(chips.length > 0 || text) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((c) => <CourseChip key={c.code} chip={c} term={term} />)}
            {text && <span className="chip text-muted">{text}</span>}
          </div>
        )}
        {hint && <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>}
      </div>
    </li>
  );
}

export function Group({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-2.5 sm:px-3">
        <h3 className="label uppercase tracking-wider">{title}</h3>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      <ul className="mt-1 divide-y divide-line/60">{children}</ul>
    </div>
  );
}

export function Callout({ items, tone = "warn" }: { items: string[]; tone?: "warn" | "info" }) {
  if (!items.length) return null;
  const c = tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <div className="rounded-2xl border px-3.5 py-2.5 text-xs leading-5"
      style={{ borderColor: `color-mix(in oklab, ${c} 30%, transparent)`, background: `color-mix(in oklab, ${c} 7%, transparent)` }}>
      <div className="flex gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" className="mt-[3px] shrink-0" aria-hidden>
          {tone === "warn"
            ? <path d="M8 1.5l6.8 12H1.2zM8 6v3.6M8 11.6v.1" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            : <><circle cx="8" cy="8" r="6.6" fill="none" stroke={c} strokeWidth="1.5" /><path d="M8 7.2v4M8 4.8v.1" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></>}
        </svg>
        <ul className="min-w-0 space-y-0.5" style={{ color: tone === "warn" ? "var(--warn)" : "var(--ink)" }}>
          {items.map((w) => <li key={w} className="break-words">{w}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function ProgramSection({ id, title, kicker, t, badge, children }: {
  id: string; title: string; kicker: string; t: Tally; badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section id={id} className="glass !rounded-[22px] scroll-mt-24">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${id}-body`}
        className="flex w-full items-center gap-3 rounded-[20px] p-4 text-left sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted">{kicker}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h2 className="h-page !text-2xl">{title}</h2>
            {badge}
          </div>
          <div className="mt-2.5 max-w-md"><ProgressBar t={t} /></div>
        </div>
        <div className="mono hidden text-sm text-muted sm:block">{t.done}/{total(t)}</div>
        <svg width="18" height="18" viewBox="0 0 20 20" className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div id={`${id}-body`} className="border-t border-line/70 px-1.5 pb-4 pt-3 sm:px-3">{children}</div>}
    </section>
  );
}
