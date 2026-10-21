"use client";
/**
 * Landing-page examples: pick a plain-English request and watch Claude answer it while the Hoos Planner page
 * beside the chat fills in. Every section is a real Spring 2027 section from the catalog (class numbers,
 * times and Course Forum numbers as of the 2026-10-21 sync). Auto-advances; a click pins one example.
 */
import { useEffect, useRef, useState } from "react";
import { useInView, usePrefersReducedMotion, useTyped } from "./usePrefersReducedMotion";

type Block = { c: string; nbr: number; days: number[]; start: number; end: number; hue: number; bad?: boolean };
type View =
  | { kind: "week"; steps: Block[][] }
  | { kind: "list"; rows: { c: string; t: string; nbr: number; diff: string; rating: string }[] }
  | { kind: "check"; rows: { l: string; s: "done" | "planned" | "missing"; note: string }[] }
  | { kind: "cart"; rows: { c: string; nbr: number; t: string; backup?: string }[] };

type Example = { ask: string; short: string; tools: string; reply: string; page: string; view: View };

const h = (hh: number, mm = 0) => hh * 60 + mm;
const ECON = { c: "ECON 2010", nbr: 12099, days: [0, 2], start: h(10), end: h(10, 50), hue: 24 };
const ANTH = { c: "ANTH 2830", nbr: 19579, days: [0, 2], start: h(14), end: h(15, 15), hue: 158 };
const DS = { c: "DS 1002", nbr: 14431, days: [0, 2], start: h(15, 30), end: h(16, 45), hue: 221 };
const RELJ = { c: "RELJ 3708", nbr: 13595, days: [1, 3], start: h(11), end: h(12, 15), hue: 276 };
const COMM_BAD = { c: "COMM 1800", nbr: 16840, days: [1, 3], start: h(11), end: h(12, 15), hue: 340, bad: true };
const COMM = { c: "COMM 1800", nbr: 16850, days: [1, 3], start: h(12, 30), end: h(13, 45), hue: 340 };

const EXAMPLES: Example[] = [
  {
    ask: "No classes before 10, and keep my Fridays free.",
    short: "No 8 a.m.s, Fridays off",
    tools: "search_sections · check_conflicts · save_plan",
    reply: "15 credits, Monday to Thursday, nothing before 10:00. I moved COMM 1800 to 12:30 so it stops overlapping RELJ 3708.",
    page: "schedule",
    view: { kind: "week", steps: [[ECON], [ECON, RELJ], [ECON, RELJ, COMM_BAD], [ECON, RELJ, COMM], [ECON, RELJ, COMM, ANTH], [ECON, RELJ, COMM, ANTH, DS]] },
  },
  {
    ask: "Find me the easiest Second Writing class that still has seats.",
    short: "Easiest Second Writing",
    tools: "search_sections · rate_course",
    reply: "RELJ 3708 has the best numbers on Course Forum: difficulty 1 out of 5 and a 5.0 rating, with all 25 seats open. Want it?",
    page: "cart",
    view: { kind: "list", rows: [
      { c: "RELJ 3708", t: "Enduring Questions in Modern Judaism · TuTh 11:00", nbr: 13595, diff: "1.0", rating: "5.0" },
      { c: "ENWR 2520", t: "Writing Human Rights · Tu 6:00 pm", nbr: 12380, diff: "1.3", rating: "4.8" },
      { c: "GETR 3464", t: "Medieval Stories of Love and Adventure · TuTh 12:30", nbr: 11874, diff: "1.5", rating: "4.8" },
    ] },
  },
  {
    ask: "I'm applying to McIntire next fall. Am I on track?",
    short: "On track for McIntire?",
    tools: "parse_audit · requirement_status · save_plan",
    reply: "Yes, if spring goes to plan. First Writing is done, and COMM 1800 and ECON 2010 are both in your cart. Your Requirements page shows the full checklist.",
    page: "requirements",
    view: { kind: "check", rows: [
      { l: "First Writing", s: "done", note: "ENWR 1510, fall" },
      { l: "COMM 1800", s: "planned", note: "#16850 in cart" },
      { l: "ECON 2010", s: "planned", note: "#12099 in cart" },
      { l: "Second Writing", s: "missing", note: "try RELJ 3708" },
    ] },
  },
  {
    ask: "Give me a backup for every class in case it fills up.",
    short: "A backup for every class",
    tools: "search_sections · check_conflicts · save_plan",
    reply: "Each class now has a backup that fits the rest of your week. In SIS, add the main section first and keep the backup's number ready.",
    page: "cart",
    view: { kind: "cart", rows: [
      { c: "DS 1002", nbr: 14431, t: "MoWe 3:30" },
      { c: "DS 1002", nbr: 14393, t: "MoWe 2:00", backup: "#14431" },
      { c: "COMM 1800", nbr: 16850, t: "TuTh 12:30" },
      { c: "COMM 1800", nbr: 16799, t: "TuTh 9:30", backup: "#16850" },
    ] },
  },
  {
    ask: "I have practice at 4 every day. Keep my afternoons clear.",
    short: "Afternoons free",
    tools: "search_sections · check_conflicts · save_plan",
    reply: "Your last class ends at 3:15 on Mondays and Wednesdays and at 12:15 on Tuesdays and Thursdays. That leaves every afternoon open for practice.",
    page: "schedule",
    view: { kind: "week", steps: (() => {
      const e = { ...ECON, nbr: 10773, start: h(9), end: h(9, 50) };
      const poetry = { c: "ENCW 2300", nbr: 20906, days: [0, 2, 4], start: h(10), end: h(10, 50), hue: 190 };
      const comm = { ...COMM, nbr: 16799, start: h(9, 30), end: h(10, 45) };
      const ds = { ...DS, nbr: 14393, start: h(14), end: h(15, 15) };
      return [[e], [e, poetry], [e, poetry, comm], [e, poetry, comm, RELJ], [e, poetry, comm, RELJ, ds]];
    })() },
  },
];

const STEP_MS = 850, TYPE_SPEED = 30, HOLD_MS = 4200;

function resultSteps(v: View) {
  return v.kind === "week" ? v.steps.length : v.rows.length;
}

export function ExampleDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0); // bumps to replay; remounts the run so typing starts over
  const [pinned, setPinned] = useState(false);
  const [progress, setProgress] = useState(0);
  const next = () => { if (pinned) setRun((r) => r + 1); else setI((x) => (x + 1) % EXAMPLES.length); };

  return (
    <div ref={ref} className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
      <div role="tablist" aria-label="Example requests" className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-2">
        {EXAMPLES.map((e, k) => (
          <button key={e.ask} role="tab" aria-selected={k === i} onClick={() => { setI(k); setPinned(true); setRun((r) => r + 1); }}
            className={`rounded-full px-3 py-1.5 text-left text-[13px] leading-snug ring-1 lg:rounded-2xl lg:px-4 lg:py-3 lg:text-[15px] transition-[background-color,box-shadow,color] duration-200 ${k === i ? "bg-white/14 text-white ring-white/30" : "bg-white/5 text-white/65 ring-white/10 hover:bg-white/10 hover:text-white"}`}>
            <span className="lg:hidden">{e.short}</span>
            <span className="hidden lg:block">“{e.ask}”</span>
            {k === i && !reduced && (
              <span className="mt-2 hidden h-0.5 lg:block overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[#ff9a3d] transition-[width] duration-700 ease-linear" style={{ width: `${progress * 100}%` }} />
              </span>
            )}
          </button>
        ))}
      </div>
      <Run key={`${i}-${run}`} ex={EXAMPLES[i]} active={inView} reduced={reduced} onProgress={setProgress} onDone={next} />
    </div>
  );
}

function Run({ ex, active, reduced, onProgress, onDone }: { ex: Example; active: boolean; reduced: boolean; onProgress: (p: number) => void; onDone: () => void }) {
  const [step, setStep] = useState(0); // 0 typing, 1 tools, 2.. results, then reply
  const typed = useTyped(ex.ask, active, TYPE_SPEED);
  const n = resultSteps(ex.view);
  const replyAt = 2 + n;
  const doneTyping = typed.length === ex.ask.length;
  const s = reduced ? replyAt : step;
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  useEffect(() => { onProgress(s / replyAt); }, [s, replyAt, onProgress]);
  useEffect(() => {
    if (reduced || !active || !doneTyping) return;
    if (step < replyAt) { const t = setTimeout(() => setStep(step + 1), step === 0 ? 500 : STEP_MS); return () => clearTimeout(t); }
    const t = setTimeout(() => done.current(), HOLD_MS);
    return () => clearTimeout(t);
  }, [step, replyAt, doneTyping, active, reduced]);

  const reply = useTyped(ex.reply, s >= replyAt, 9);
  const shown = Math.max(0, Math.min(n, s - 1));

  return (
    <div className="glass-night grid min-w-0 gap-2 p-2 sm:grid-cols-2 sm:gap-3 sm:p-4">
      {/* the chat */}
      <div className="flex min-h-[170px] min-w-0 flex-col gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 sm:min-h-[310px]">
        <div className="text-[11px] text-white/50">Claude</div>
        <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-[#2563eb] px-3 py-2 text-[13px] text-white">{typed || " "}<span className={doneTyping ? "" : "caret"} /></div>
        {s >= 1 && <div className="pop-in flex items-center gap-1.5 text-[11px] text-white/55"><Spinner done={s >= replyAt} /> Hoos Planner: {ex.tools}</div>}
        {s >= replyAt && <div className="pop-in max-w-[94%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-[13px] leading-5 text-white/90">{reply}</div>}
      </div>
      {/* the site */}
      <div className="min-h-[290px] min-w-0 rounded-2xl bg-[#f7f8fc] p-3 text-[#111a33] ring-1 ring-white/10 dark:bg-[#0f1729] dark:text-[#e6ebf7]">
        <div className="flex items-center justify-between text-[11px] text-[#5b6478] dark:text-[#9aa5bd]">
          <span className="truncate">hoosplanner · {ex.page}</span>
          <span className="flex shrink-0 items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#1a9e5c]" />Live</span>
        </div>
        <div className="mt-2">
          {ex.view.kind === "week" && <Week blocks={shown ? ex.view.steps[shown - 1] : []} empty={shown === 0} />}
          {ex.view.kind === "list" && <List rows={ex.view.rows.slice(0, shown)} />}
          {ex.view.kind === "check" && <Check rows={ex.view.rows.slice(0, shown)} />}
          {ex.view.kind === "cart" && <Cart rows={ex.view.rows.slice(0, shown)} />}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{s >= replyAt ? ex.reply : ""}</p>
    </div>
  );
}

function Spinner({ done }: { done: boolean }) {
  return done
    ? <span className="text-[#8ff0bd]">✓</span>
    : <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />;
}

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START = h(8), SPAN = h(18) - h(8);
const clock = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")}`;

function Week({ blocks, empty }: { blocks: Block[]; empty: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-1 text-[9px]">
      {DAY.map((d, di) => (
        <div key={d} className="min-w-0">
          <div className="pb-1 text-center text-[#5b6478] dark:text-[#9aa5bd]">{d}</div>
          <div className="relative h-[230px] rounded-md bg-[#e8ebf4] dark:bg-white/5">
            {[10, 12, 14, 16].map((t) => <div key={t} className="absolute inset-x-0 border-t border-dashed border-black/5 dark:border-white/5" style={{ top: `${((h(t) - START) / SPAN) * 100}%` }} />)}
            {blocks.filter((b) => b.days.includes(di)).map((b) => (
              <div key={`${b.nbr}`} className={`block-arrive demo-block absolute inset-x-0.5 overflow-hidden rounded px-0.5 py-px font-semibold leading-tight ${b.bad ? "demo-block-bad ring-2 ring-[#e5484d]" : ""}`}
                style={{ top: `${((b.start - START) / SPAN) * 100}%`, height: `${((b.end - b.start) / SPAN) * 100}%`, "--h": b.hue } as React.CSSProperties}>
                <span className="block truncate">{b.c}</span><span className="block truncate font-normal opacity-80">{clock(b.start)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {empty && <div className="col-span-5 pt-1 text-center text-[10px] text-[#5b6478] dark:text-[#9aa5bd]">Waiting for Claude…</div>}
    </div>
  );
}

function List({ rows }: { rows: { c: string; t: string; nbr: number; diff: string; rating: string }[] }) {
  return (
    <div className="space-y-1.5 text-[12px]">
      <div className="flex justify-between text-[10px] text-[#5b6478] dark:text-[#9aa5bd]"><span>Second Writing, open seats</span><span>easiest first</span></div>
      {rows.map((r, k) => (
        <div key={r.nbr} className={`pop-in rounded-lg px-2.5 py-1.5 ring-1 ${k === 0 ? "bg-[#1a9e5c]/10 ring-[#1a9e5c]/40" : "bg-white ring-black/5 dark:bg-white/5 dark:ring-white/10"}`}>
          <div className="flex items-baseline justify-between gap-2"><span className="font-semibold">{r.c}</span><span className="mono text-[11px] opacity-60">#{r.nbr}</span></div>
          <div className="truncate text-[11px] opacity-70">{r.t}</div>
          <div className="mt-0.5 text-[10px]"><span className="text-[#1a7f4e] dark:text-[#8ff0bd]">difficulty {r.diff}</span> · rating {r.rating}</div>
        </div>
      ))}
    </div>
  );
}

const MARK = { done: ["✓", "bg-[#1a9e5c] text-white"], planned: ["•", "bg-[#e57200]/20 text-[#a85300]"], missing: ["", "ring-1 ring-[#8a93a8]"] } as const;

function Check({ rows }: { rows: { l: string; s: "done" | "planned" | "missing"; note: string }[] }) {
  return (
    <div className="text-[12px]">
      <div className="text-[10px] text-[#5b6478] dark:text-[#9aa5bd]">McIntire prerequisites</div>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.l} className="pop-in flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${MARK[r.s][1]}`}>{MARK[r.s][0]}</span>
            <span className="flex-1 font-medium">{r.l}</span>
            <span className="truncate text-[10px] opacity-60">{r.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cart({ rows }: { rows: { c: string; nbr: number; t: string; backup?: string }[] }) {
  return (
    <div className="space-y-1.5 text-[12px]">
      <div className="text-[10px] text-[#5b6478] dark:text-[#9aa5bd]">Cart, Spring 2027</div>
      {rows.map((r) => (
        <div key={r.nbr} className={`pop-in flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ring-1 ${r.backup ? "ml-3 bg-[#e57200]/5 ring-[#e57200]/25" : "bg-white ring-black/5 dark:bg-white/5 dark:ring-white/10"}`}>
          <span className="min-w-0"><span className="font-semibold">{r.c}</span> <span className="text-[11px] opacity-60">{r.t}</span></span>
          <span className="flex shrink-0 items-center gap-1.5">
            {r.backup && <span className="rounded-full bg-[#e57200]/15 px-1.5 text-[10px] font-semibold text-[#a85300]">Backup for {r.backup}</span>}
            <span className="mono text-[11px] opacity-60">#{r.nbr}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
