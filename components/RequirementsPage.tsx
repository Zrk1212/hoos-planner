"use client";
/**
 * Requirements: a Stellic-style audit of the programs in the plan's goals (College gen-eds, McIntire and SDS
 * prerequisites). Filled from the pasted audit (row.profile) plus the spring cart, live as Claude saves.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item, ItemStatus, RequirementStatus } from "@/lib/requirements";
import type { Goal } from "@/lib/plan-schema";
import { DISCIPLINES, ENGAGEMENTS, type Section } from "@/lib/types";
import { PlanShell, WaitingForClaude } from "./PlanShell";
import type { ActivePlan } from "./useActivePlan";
import { Callout, Group, Legend, ProgramSection, ProgressRing, ReqRow, StatusIcon, tally, type ChipSpec, type Tally } from "./ReqTree";

const CODE_RE = /\b[A-Z]{2,5} \d{4}[A-Z]?\b/g;

const PROGRAM: Record<Goal, { title: string; kicker: string }> = {
  college: { title: "College of Arts & Sciences", kicker: "General education · Engagements pathway" },
  mcintire: { title: "McIntire School of Commerce", kicker: "Admission prerequisites · B.S. Commerce" },
  sds: { title: "School of Data Science", kicker: "Admission prerequisites · BSDS" },
};

/** One audit line, normalized for rendering and for change tracking. */
interface Req { key: string; label: string; sub?: string; status: ItemStatus; chips: ChipSpec[]; text?: string; hint?: string }

interface Ctx { cart: Set<string>; fresh: Set<string> }

function chipsFor(by: string | undefined, status: ItemStatus, ctx: Ctx, perCourse?: Map<string, ItemStatus>): { chips: ChipSpec[]; text?: string } {
  if (!by) return { chips: [] };
  const codes = [...new Set(by.match(CODE_RE) ?? [])];
  if (!codes.length) return { chips: [], text: by };
  return {
    chips: codes.map((code) => {
      const st = perCourse?.get(code) ?? status;
      const cart = st === "planned" && ctx.cart.has(code);
      return { code, status: st, cart, fresh: cart && ctx.fresh.has(code) };
    }),
  };
}

function req(key: string, label: string, item: Item, ctx: Ctx, opts: { sub?: string; hint?: string; perCourse?: Map<string, ItemStatus> } = {}): Req {
  const { chips, text } = chipsFor(item.by, item.status, ctx, opts.perCourse);
  const hint = item.note ?? (item.status === "missing" ? opts.hint : undefined);
  return { key, label, sub: opts.sub, status: item.status, chips, text, hint };
}

/** "Worst" non-missing status among a set, used for rules that depend on other rows. */
function rollup(ss: ItemStatus[]): ItemStatus {
  if (ss.includes("missing")) return "missing";
  if (ss.includes("planned")) return "planned";
  if (ss.includes("in_progress")) return "in_progress";
  return "done";
}

function creditsStatus(have: number, projected: number, need: number): ItemStatus {
  return have >= need ? "done" : projected >= need ? "in_progress" : "missing";
}

interface Built { goal: Goal; groups: Array<{ title: string; aside?: string; rows: Req[] }>; warnings: string[]; notes: string[]; ready?: boolean }

function buildCollege(st: RequirementStatus, ctx: Ctx): Built {
  const eg = st.engagements.areas.map((a) => req(`eg-${a.nbr}`, `EGMT ${a.nbr}`, a.item, ctx, { sub: a.name, hint: `Any EGMT ${a.nbr} section (${ENGAGEMENTS[a.nbr]}). First-years take these over two semesters.` }));
  const l = st.literacies;
  const qcdDone = l.qcd.courses.filter((q) => q.status === "done").length;
  // partial QCD progress (1 of 2) reads as in progress, like Stellic's half-filled requirement
  // partly covered: in progress if any QCD course is underway or done, planned if they're only in the cart
  const qcdItem: Item = l.qcd.item.status === "missing" && l.qcd.courses.length
    ? { ...l.qcd.item, status: l.qcd.courses.some((q) => q.status === "done" || q.status === "in_progress") ? "in_progress" : "planned" }
    : l.qcd.item;
  const lit = [
    req("fwr", "First Writing", l.fwr, ctx, { hint: "One First Writing course (ENWR 1510 or a stretch pair), or an exemption." }),
    req("swr", "Second Writing", l.swr, ctx, { hint: "One Second Writing course, C- or better. It can also count as a Discipline." }),
    req("wl", "World Language", l.worldLanguage, ctx, { hint: "Through the 2020 level of one language, or placement out." }),
    req("qcd", "Quantification, Computation & Data", qcdItem, ctx, {
      sub: `${qcdDone} of ${l.qcd.needed}`,
      hint: `${l.qcd.needed} QCD courses (6 credits).`,
      perCourse: new Map(l.qcd.courses.map((q) => [q.course, q.status])),
    }),
  ];
  const d = st.disciplines;
  const disc = d.areas.map((a) => req(`d-${a.code}`, a.name, a.item, ctx, { sub: a.code, hint: `A course with the ${a.code} attribute (${DISCIPLINES[a.code]}).` }));
  const deptStatus: ItemStatus = d.departments.length >= d.departmentsNeeded ? rollup(d.areas.map((a) => a.item.status).filter((s) => s !== "missing"))
    : d.departments.length ? "in_progress" : "missing";
  disc.push({
    key: "depts", label: "Six different departments", sub: `${d.departments.length} of ${d.departmentsNeeded}`, status: deptStatus,
    chips: [], text: d.departments.length ? d.departments.join(" · ") : undefined,
    hint: d.departments.length < d.departmentsNeeded ? `Your Discipline courses must span at least ${d.departmentsNeeded} departments.` : undefined,
  });
  const alts = Object.entries(d.alternatives);
  const c = st.credits;
  const over = c.nonCollege > c.nonCollegeMax;
  const credit: Req[] = [{
    key: "noncol", label: "Non-College credit cap", sub: `${c.nonCollege} of ${c.nonCollegeMax} max`, status: over ? "missing" : "done", chips: [],
    hint: over ? `Only ${c.nonCollegeMax} credits from outside the College count toward a College degree.` : undefined,
  }];
  return {
    goal: "college",
    groups: [
      { title: "Engagements", aside: `${st.engagements.perSemesterCap} per semester max`, rows: eg },
      { title: "Literacies", rows: lit },
      { title: "Disciplines", aside: alts.length ? `Counts once: ${alts.map(([k, v]) => `${k} (${v.join(" or ")})`).join("; ")}` : undefined, rows: disc },
      { title: "Credit rules", rows: credit },
    ],
    warnings: [...st.engagements.warnings, ...st.disciplines.warnings],
    notes: [],
  };
}

function buildMcIntire(st: RequirementStatus, ctx: Ctx): Built {
  const m = st.mcintire, g = m.gradedUvaCredits;
  return {
    goal: "mcintire", ready: m.ready,
    groups: [{
      title: "Prerequisites", rows: [
        req("m-comm", "COMM 1800", m.comm1800, ctx, { sub: "Foundations of Commerce", hint: "Letter grade required. It can still be in progress at the May 4 deadline." }),
        req("m-econ", "ECON 2010", m.econ2010, ctx, { sub: "Microeconomics", hint: "Letter grade required (AP credit may apply)." }),
        req("m-fwr", "First Writing", m.fwr, ctx, { hint: "Can still be in progress at the May 4 deadline." }),
        { key: "m-cr", label: "Graded UVA credits", sub: `${g.have} now · ${g.projected} projected of ${g.need}${g.projected < g.need ? ` (${g.need - g.projected} short)` : ""}`, status: creditsStatus(g.have, g.projected, g.need), chips: [],
          hint: g.projected < g.need ? `${g.need - g.projected} more graded UVA credits needed before you start at McIntire in the fall. AP and transfer credit don't count.` : undefined },
      ],
    }],
    warnings: [], notes: m.notes,
  };
}

function buildSds(st: RequirementStatus, ctx: Ctx): Built {
  const s = st.sds, u = s.uvaCredits;
  return {
    goal: "sds", ready: s.ready,
    groups: [{
      title: "Prerequisites", rows: [
        req("s-ds", "DS 1001", s.ds1001, ctx, { sub: "Foundations of Data Science", hint: "At UVA, C- or better, no CR/NC." }),
        req("s-prog", "Programming", s.programming, ctx, { sub: "DS 1002, CS 111x or AP CS A", hint: "One intro programming course or AP CS A credit." }),
        { key: "s-cr", label: "UVA credits", sub: `${u.have} now · ${u.projected} projected of ${u.need}`, status: creditsStatus(u.have, u.projected, u.need), chips: [],
          hint: u.projected < u.need ? `${u.need - u.projected} more UVA credits needed by the application.` : undefined },
      ],
    }],
    warnings: s.notes.filter((n) => /Principles|cannot/.test(n)), notes: s.notes.filter((n) => !/Principles|cannot/.test(n)),
  };
}

const BUILD: Record<Goal, (st: RequirementStatus, ctx: Ctx) => Built> = { college: buildCollege, mcintire: buildMcIntire, sds: buildSds };

/** Keys whose status changed since the previous save; cleared after the highlight plays. */
function useChanged(sig: Map<string, ItemStatus>): Set<string> {
  const prev = useRef<Map<string, ItemStatus> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    const before = prev.current;
    prev.current = sig;
    if (!before) return;
    const diff = new Set([...sig].filter(([k, v]) => before.has(k) && before.get(k) !== v).map(([k]) => k));
    if (!diff.size) return;
    setChanged(diff);
    const t = setTimeout(() => setChanged(new Set()), 2600);
    return () => clearTimeout(t);
  }, [sig]);
  return changed;
}

function Audit({ p, st }: { p: ActivePlan; st: RequirementStatus }) {
  const term = p.catalog?.term.name ?? "Spring 2027";
  const ctx = useMemo<Ctx>(() => ({
    cart: new Set(p.main.map((s) => s.course)),
    fresh: new Set(p.main.filter((s) => p.fresh.has(s.class_nbr)).map((s) => s.course)),
  }), [p.main, p.fresh]);
  const built = useMemo(() => p.goals.map((g) => BUILD[g](st, ctx)), [p.goals, st, ctx]);
  const sig = useMemo(() => new Map(built.flatMap((b) => b.groups.flatMap((g) => g.rows.map((r) => [`${b.goal}:${r.key}`, r.status] as const)))), [built]);
  const changed = useChanged(sig);
  const tallies = built.map((b) => tally(b.groups.flatMap((g) => g.rows.filter((r) => r.key !== "noncol").map((r) => r.status))));
  const c = st.credits;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {built.map((b, i) => (
          <a key={b.goal} href={`#req-${b.goal}`} className="glass !rounded-[22px] flex items-center gap-4 p-4 transition-transform duration-200 hover:-translate-y-0.5">
            <ProgressRing t={tallies[i]} />
            <div className="min-w-0">
              <div className="text-xs text-muted">{b.goal === "college" ? "Gen-eds" : "Prerequisites"}</div>
              <div className="font-medium leading-tight">{PROGRAM[b.goal].title}</div>
              <div className="mt-1 text-xs text-muted"><span className="mono text-ink">{tallies[i].done}</span> of {tallies[i].done + tallies[i].in_progress + tallies[i].planned + tallies[i].missing} satisfied</div>
              <div className="mt-1.5"><MiniLegend t={tallies[i]} /></div>
            </div>
          </a>
        ))}
        <div className="glass !rounded-[22px] p-4">
          <div className="text-xs text-muted">Projected credits</div>
          <div className="mt-0.5 flex items-baseline gap-1.5"><span className="display text-4xl">{c.projected}</span><span className="text-xs text-muted">after {term}</span></div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-muted">Earned</dt><dd className="mono" style={{ color: "var(--ok)" }}>{c.earned}</dd></div>
            <div><dt className="text-muted">Now</dt><dd className="mono text-accent">{c.inProgress}</dd></div>
            <div><dt className="text-muted">{term.split(" ")[0]}</dt><dd className="mono text-orange-ink">{c.planned}</dd></div>
          </dl>
          {c.test > 0 && <p className="mt-1 text-[11px] text-muted">Includes {c.test} AP, test and transfer credits</p>}
        </div>
      </div>

      <Callout items={st.warnings} />

      {built.map((b, i) => (
        <ProgramSection key={b.goal} id={`req-${b.goal}`} title={PROGRAM[b.goal].title} kicker={PROGRAM[b.goal].kicker} t={tallies[i]}
          badge={b.ready === undefined ? null : b.ready
            ? <span className="chip" style={{ color: "var(--ok)", background: "color-mix(in oklab, var(--ok) 13%, transparent)" }}>On track to apply</span>
            : <span className="chip text-muted">Not ready yet</span>}>
          <div className="mb-3 px-2.5 sm:px-3"><Legend t={tallies[i]} /></div>
          {b.groups.map((g) => (
            <Group key={g.title} title={g.title} aside={g.aside}>
              {g.rows.map((r) => (
                <ReqRow key={r.key} status={r.status} label={r.label} sub={r.sub} chips={r.chips} text={r.text} hint={r.hint} term={term}
                  changed={changed.has(`${b.goal}:${r.key}`)} />
              ))}
            </Group>
          ))}
          {(b.warnings.length > 0 || b.notes.length > 0) && (
            <div className="mt-4 space-y-2 px-1.5">
              <Callout items={b.warnings} />
              <Callout items={b.notes} tone="info" />
            </div>
          )}
        </ProgramSection>
      ))}
    </div>
  );
}

function MiniLegend({ t }: { t: Tally }) {
  const parts = ([["in_progress", "in progress"], ["planned", "planned"]] as const).filter(([k]) => t[k] > 0);
  if (!parts.length) return null;
  return (
    <div className="flex flex-wrap gap-x-2 text-[11px] text-muted">
      {parts.map(([k, l]) => <span key={k} className="inline-flex items-center gap-1"><StatusIcon status={k} size={11} />{t[k]} {l}</span>)}
    </div>
  );
}

/** SIS attribute -> what it counts toward, for the no-profile preview. */
function countsToward(s: Section): string[] {
  const out: string[] = [];
  const eg = /^EGMT (15[1-4]0)$/.exec(s.course);
  if (eg) out.push(`Engagement · ${ENGAGEMENTS[eg[1] as keyof typeof ENGAGEMENTS]}`);
  for (const a of s.attrs ?? []) {
    if (a === "ASUR-R21C1") out.push("First Writing");
    else if (a === "ASUR-R21C2") out.push("Second Writing");
    else if (a === "ASUW-WL") out.push("World Language");
    else if (a === "ASUQ-QCD") out.push("QCD");
    else if (a.startsWith("ASUD-")) {
      const code = a.slice(5) as keyof typeof DISCIPLINES;
      if (code in DISCIPLINES) out.push(`Discipline · ${DISCIPLINES[code]}`);
    }
  }
  if (s.course === "COMM 1800" || s.course === "ECON 2010") out.push("McIntire prerequisite");
  if (s.course === "DS 1001") out.push("SDS prerequisite");
  if (s.course === "DS 1002" || /^CS 111\d$/.test(s.course)) out.push("SDS programming");
  return [...new Set(out)];
}

function goalList(goals: string[]): string {
  const parts = [goals.includes("college") ? "every Engagement, Literacy and Discipline" : "", goals.includes("mcintire") ? "the McIntire prerequisites" : "", goals.includes("sds") ? "the School of Data Science prerequisites" : ""].filter(Boolean);
  if (!parts.length) return "every Engagement, Literacy and Discipline";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function NoProfile({ p }: { p: ActivePlan }) {
  const term = p.catalog?.term.name ?? "Spring 2027";
  return (
    <div className="space-y-5">
      <div className="glass !rounded-[22px] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--accent) 12%, transparent)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" /><path d="M16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" /><path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="h-page">Your audit isn&apos;t here yet</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted">
              Paste your Stellic audit into your AI chat and this fills in: {goalList(p.goals)}, checked off as you go.
            </p>
          </div>
        </div>
      </div>
      {p.main.length > 0 && (
        <div className="glass !rounded-[22px] p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="label uppercase tracking-wider">What your {term} classes count toward</h3>
            <span className="text-xs text-muted">From SIS attributes</span>
          </div>
          <ul className="mt-2 divide-y divide-line/60">
            {p.main.map((s) => {
              const counts = countsToward(s);
              return (
                <li key={s.class_nbr} className={`flex items-start gap-3 py-2.5 ${p.fresh.has(s.class_nbr) ? "block-arrive rounded-xl" : ""}`}>
                  <div className="pt-0.5"><StatusIcon status="planned" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="mono text-sm font-medium">{s.course}</span>
                      <span className="truncate text-sm text-muted">{s.descr}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {counts.length ? counts.map((c) => <span key={c} className="chip">{c}</span>) : <span className="text-xs text-muted">Elective credit</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RequirementsBody({ p }: { p: ActivePlan }) {
  if (!p.row?.profile) return p.main.length || p.backups.length ? <NoProfile p={p} /> : <WaitingForClaude what="your audit or classes" />;
  if (!p.status) return <WaitingForClaude what="your audit" />;
  return <Audit p={p} st={p.status} />;
}

export function RequirementsPage() {
  return <PlanShell title="Requirements" blurb="What your plan counts toward.">{(p) => <RequirementsBody p={p} />}</PlanShell>;
}
