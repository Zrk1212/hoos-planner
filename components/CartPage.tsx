"use client";
/**
 * /cart: the student's cart the way SIS's shopping cart shows it, live from the plan Claude saves.
 * Read-only: changes happen in the chat.
 */
import { useState } from "react";
import { cartCreditsDetail, companionProblems, creditKey, enrollOrder, isSub } from "@/lib/search";
import type { Section } from "@/lib/types";
import { CartTable, classLabel } from "./CartTable";
import { PlanShell, WaitingForClaude } from "./PlanShell";
import { useToast } from "./Toast";
import type { ActivePlan } from "./useActivePlan";

export function CartPage() {
  return <PlanShell title="Your cart" blurb="Every section, the way SIS shows it.">{(p) => <CartBody p={p} />}</PlanShell>;
}

function Stat({ label, value, tone = "", sub }: { label: string; value: React.ReactNode; tone?: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function CartBody({ p }: { p: ActivePlan }) {
  const { main, backups, unknown, conflicts, fresh, catalog } = p;
  if (!main.length && !backups.length) {
    return (
      <>
        {unknown.length > 0 && <UnknownLine unknown={unknown} />}
        <WaitingForClaude what="classes to your cart" />
      </>
    );
  }
  const term = catalog?.term ?? null;
  const { credits, notes } = cartCreditsDetail(main);
  const creditWarn = main.length > 0 && (credits < 12 || credits > 18);
  const conflicted = new Set(conflicts.flatMap((c) => [c.a, c.b]));

  return (
    <div className="space-y-5">
      <div className="glass !rounded-[22px] overflow-hidden">
        <div className="grid grid-cols-2 divide-line/70 sm:grid-cols-4 sm:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-line/70 sm:[&>*:nth-child(-n+2)]:border-b-0 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-line/70 sm:[&>*:nth-child(odd)]:border-r-0">
          <Stat label="Classes" value={main.length} sub={`${new Set(main.filter((s) => !isSub(s)).map(creditKey)).size} courses`} />
          <Stat label="Credits" value={credits} tone={creditWarn ? "text-warn" : ""}
            sub={credits < 12 ? "Below the 12-credit full-time minimum" : credits > 18 ? "Over 18 needs the dean's permission" : "Within 12–18"} />
          <Stat label="Conflicts" value={conflicts.length} tone={conflicts.length ? "text-bad" : "text-ok"} sub={conflicts.length ? "Time overlaps below" : "No time overlaps"} />
          <Stat label="Backups" value={backups.length} tone={backups.length ? "text-orange-ink" : ""} sub={backups.length ? "If a main pick fills" : "None yet"} />
        </div>
        {(conflicts.length > 0 || notes.length > 0) && (
          <div className="space-y-1 border-t border-line/70 px-4 py-3 text-xs sm:px-5">
            {conflicts.map((c) => <div key={`${c.a}-${c.b}`} className="text-bad">⚠ {c.reason}</div>)}
            {notes.map((n) => <div key={n} className="text-muted">{n}</div>)}
          </div>
        )}
      </div>

      {unknown.length > 0 && <UnknownLine unknown={unknown} />}
      <MissingSections main={main} catalog={catalog?.sections ?? []} />

      <section className="glass !rounded-[22px] overflow-hidden">
        <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
          <h2 className="text-lg font-semibold">Shopping cart</h2>
          <span className="text-xs text-muted">{term?.name ?? ""} · open a class for grading, dates, attributes and reserved seats</span>
        </header>
        {main.length ? <CartTable sections={main} term={term} fresh={fresh} conflicted={conflicted} /> : <p className="px-5 pb-5 text-sm text-muted">No main sections yet, only backups.</p>}
      </section>

      {backups.length > 0 && (
        <section className="glass !rounded-[22px] overflow-hidden">
          <header className="px-4 pb-2 pt-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Backups</h2>
              <span className="chip !bg-orange/15 !text-orange-ink">{backups.length}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">Swap one in if its main pick is closed when your window opens. Backups are left out of the credit total and the conflict check.</p>
          </header>
          <CartTable sections={backups} term={term} fresh={fresh} backup main={main} />
        </section>
      )}

      {main.length > 0 && <Enroll main={main} />}
    </div>
  );
}

/** Lecture/discussion pairs SIS would reject: a missing discussion or lab, or one that belongs to another lecture. */
function MissingSections({ main, catalog }: { main: Section[]; catalog: Section[] }) {
  const problems = companionProblems(main, catalog);
  if (!problems.length) return null;
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-xs text-warn">
      {problems.map((p) => <p key={p}>⚠ {p}.</p>)}
      <p className="mt-1">Ask your AI to fix {problems.length === 1 ? "this" : "these"} before you enroll.</p>
    </div>
  );
}

export function UnknownLine({ unknown }: { unknown: number[] }) {
  return (
    <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-xs text-warn">
      ⚠ Not a class number in this term&apos;s catalog: {unknown.map((n) => <span key={n} className="mono mr-2">#{n}</span>)} Ask your AI to check {unknown.length === 1 ? "it" : "them"}.
    </p>
  );
}

function Enroll({ main }: { main: Section[] }) {
  // a second section of the same class can't be enrolled alongside the first: leave spares out of the list
  const seenKeys = new Set<string>();
  const spares: Section[] = [];
  const order = enrollOrder(main).filter((s) => {
    if (isSub(s)) return true;
    const k = creditKey(s);
    if (seenKeys.has(k)) { spares.push(s); return false; }
    seenKeys.add(k);
    return true;
  });
  const nbrs = order.map((s) => s.class_nbr).join(", ");
  const [copied, setCopied] = useState(false);
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
    <section className="glass !rounded-[22px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Enroll</h2>
          <p className="mt-0.5 text-xs text-muted">Reserved-seat and smallest classes first, so the ones most likely to fill go in before they do.</p>
        </div>
        <button className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy class numbers"}</button>
      </div>
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((s, i) => (
          <li key={s.class_nbr} className="flex min-w-0 items-center gap-2.5 rounded-xl bg-chip/60 px-3 py-2 text-sm">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-elev text-[11px] font-semibold text-muted">{i + 1}</span>
            <span className="mono font-semibold">{s.class_nbr}</span>
            <span className="truncate text-xs text-muted">{classLabel(s)}</span>
          </li>
        ))}
      </ol>
      {spares.length > 0 && <p className="mt-2 text-xs text-warn">Left out {spares.map((x) => `#${x.class_nbr}`).join(", ")}: a second section of a class already in the list. Keep it as a backup instead.</p>}
      {copyError && <p className="mt-2 text-xs text-warn">Clipboard blocked; select and copy: <span className="mono select-all">{nbrs}</span></p>}
      <p className="mt-3 text-xs text-muted">SIS → Enrollment → Add by class number, in this order. You press Enroll yourself.</p>
    </section>
  );
}
