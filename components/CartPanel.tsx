"use client";
import { useState } from "react";
import { DAY_LABEL, DAY_ORDER, findConflicts, fmtMeetings, fmtTime, quarterOf } from "@/lib/meetings";
import { cartCredits, enrollOrder } from "@/lib/search";
import type { Section } from "@/lib/types";
import type { TermInfo } from "@/lib/catalog-types";
import { useToast } from "./Toast";

export function CartPanel({ cart, unknown = [], term = null, onRemove, onClear, readOnly = false }: { cart: Section[]; unknown?: number[]; term?: TermInfo | null; onRemove?: (n: number) => void; onClear?: () => void; readOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  const conflicts = findConflicts(cart);
  const order = enrollOrder(cart);
  const credits = cartCredits(cart);
  const nbrs = order.map((s) => s.class_nbr).join(", ");
  const [copyError, setCopyError] = useState(false);
  const { toast } = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(nbrs);
      setCopied(true); setCopyError(false); setTimeout(() => setCopied(false), 1500);
      toast({ kind: "ok", title: `Copied ${order.length} class number${order.length === 1 ? "" : "s"}`, body: "In SIS: Enrollment, then Add by class number, in this order." });
    } catch { setCopyError(true); toast({ kind: "error", title: "Clipboard is blocked", body: "Select the numbers under the button and copy them." }); }
  }
  return (
    <div className="glass !rounded-[22px] p-4 lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <div className="label">Cart · {cart.length} sections · {credits} cr</div>
        {!readOnly && onClear && (cart.length > 0 || unknown.length > 0) && <button className="text-xs text-muted hover:text-bad" onClick={onClear}>clear</button>}
      </div>
      {unknown.length > 0 && (
        <div className="mt-1 text-xs text-warn">
          Not in this term&apos;s catalog any more: {unknown.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 mr-2"><span className="mono">#{n}</span>{!readOnly && onRemove && <button className="hover:text-bad" onClick={() => onRemove(n)} aria-label={`remove ${n}`}>✕</button>}</span>
          ))}
        </div>
      )}
      {credits > 0 && credits < 12 && <p className="text-xs text-warn mt-1">Below the 12-credit full-time minimum.</p>}
      {credits > 18 && <p className="text-xs text-warn mt-1">Over 18 credits needs the dean&apos;s permission.</p>}
      {conflicts.length > 0 ? (
        <div className="mt-2 text-xs text-bad space-y-0.5">{conflicts.map((c) => <div key={`${c.a}-${c.b}`}>⚠ {c.reason}</div>)}</div>
      ) : cart.length > 1 ? <p className="text-xs text-ok mt-1">No time conflicts.</p> : null}
      <ul className="mt-2 divide-y divide-line/60">
        {cart.map((s) => (
          <li key={s.class_nbr} className="py-1.5 text-sm flex gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate"><span className="font-medium">{s.course}</span> <span className="text-muted">{s.component}-{s.class_section}</span></div>
              <div className="text-xs text-muted mono">{fmtMeetings(s.meetings)}{s.start_dt && s.end_dt && (Date.parse(s.end_dt) - Date.parse(s.start_dt)) / 86400000 < 70 ? ` (${s.start_dt.slice(5)}→${s.end_dt.slice(5)})` : ""}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="mono text-xs">#{s.class_nbr}</div>
              {!readOnly && onRemove && <button className="text-xs text-muted hover:text-bad" onClick={() => onRemove(s.class_nbr)}>remove</button>}
            </div>
          </li>
        ))}
      </ul>
      {cart.length > 0 && (
        <>
          <div className="mt-3 label">Enroll order (smallest caps first)</div>
          <ol className="text-xs mt-1 space-y-0.5 list-decimal pl-4">
            {order.map((s) => <li key={s.class_nbr}><span className="mono">{s.class_nbr}</span> {s.course} <span className="text-muted">cap {s.class_capacity ?? "?"}{s.reserve_caps.length ? ", reserve caps" : ""}</span></li>)}
          </ol>
          <div className="mt-2 flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={copy}>{copied ? "Copied" : "Copy class numbers"}</button>
          </div>
          {copyError && <p className="text-[11px] text-warn mt-1">Clipboard blocked; select and copy: <span className="mono select-all">{nbrs}</span></p>}
          <p className="text-[11px] text-muted mt-1">SIS → Enrollment → Add by class number, in this order.</p>
          {!readOnly && <WeekGrid cart={cart} term={term} />}
        </>
      )}
    </div>
  );
}

function WeekGrid({ cart, term }: { cart: Section[]; term: TermInfo | null }) {
  const days = DAY_ORDER.slice(0, 5);
  const start = 8 * 60, end = 21 * 60;
  const H = 220;
  const y = (m: number) => ((m - start) / (end - start)) * H;
  return (
    <div className="mt-3">
      <div className="label mb-1">Week</div>
      <div className="grid grid-cols-5 gap-px bg-line rounded-xl overflow-hidden text-[10px]">
        {days.map((d) => (
          <div key={d} className="bg-elev relative" style={{ height: H }}>
            <div className="absolute top-0 left-0 right-0 text-center text-muted">{DAY_LABEL[d]}</div>
            {cart.flatMap((s, i) => s.meetings.filter((m) => m.days.includes(d) && m.start != null).map((m, k) => {
              const q = quarterOf({ start_dt: m.start_dt, end_dt: m.end_dt }, term);
              const half = q === "A" || q === "B";
              const second = q === "B";
              return (
                <div key={`${s.class_nbr}-${k}`} className="absolute rounded-[4px] px-0.5 overflow-hidden leading-tight" title={`${s.course} ${fmtTime(m.start)}–${fmtTime(m.end)}`}
                  style={{ top: y(m.start!), height: Math.max(8, y(m.end!) - y(m.start!)), left: half ? (second ? "50%" : "2%") : "2%", right: half ? (second ? "2%" : "50%") : "2%", background: `hsl(${(i * 67) % 360} 60% 45% / 0.85)`, color: "white" }}>
                  {s.subject} {s.catalog_nbr}
                </div>
              );
            }))}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted mt-0.5">8 am – 9 pm. Half-term sections sit left (first half) or right (second half).</p>
    </div>
  );
}
