"use client";
/**
 * The SIS-style shopping cart table used by the Cart page: one row per section with the columns SIS shows
 * (class, description, days & times, room, instructor, units, status, seats, class number) and a details row
 * per section (grading, session, dates, requirement designation, attributes, reserve caps).
 * A table at md and up, one card per section below md so phones never scroll sideways.
 */
import { Fragment, useState } from "react";
import { fmtTime, quarterOf } from "@/lib/meetings";
import type { TermInfo } from "@/lib/catalog-types";
import type { Meeting, Section } from "@/lib/types";
import { DISCIPLINES } from "@/lib/types";
import { CopyButton } from "./Copy";
import type { BackupSection } from "./useActivePlan";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2027-01-20" -> "Jan 20" (no Date parsing, so no timezone drift) */
export function fmtDate(iso: string | null): string {
  if (!iso) return "TBA";
  const [, m, d] = iso.split("-");
  const mi = parseInt(m, 10) - 1;
  return MONTHS[mi] ? `${MONTHS[mi]} ${parseInt(d, 10)}` : iso;
}

export function classLabel(s: Section): string {
  return `${s.course}-${s.class_section ?? "?"}${s.component ? ` ${s.component}` : ""}`;
}

const ATTR_LABEL: Record<string, string> = {
  "ASUR-R21C1": "First Writing (FWR)",
  "ASUR-R21C2": "Second Writing (SWR)",
  "ASUW-WL": "World Language (WL)",
  "ASUQ-QCD": "Quantification, Computation & Data (QCD)",
  "CORE-CRITTHINK": "Critical Thinking",
  "CORE-ORALCOMM": "Oral Communication",
  "CORE-WRITTEN": "Written Communication",
  "CORE-QUANT": "Quantitative Reasoning",
  "CORE-SCIENTIFIC": "Scientific Reasoning",
};

function attrLabel(a: string): { short: string; long: string } {
  if (a.startsWith("ASUD-")) {
    const code = a.slice(5) as keyof typeof DISCIPLINES;
    return { short: code, long: DISCIPLINES[code] ? `${DISCIPLINES[code]} (${code})` : a };
  }
  const long = ATTR_LABEL[a] ?? a;
  const m = long.match(/\(([A-Z]+)\)$/);
  return { short: m ? m[1] : long, long };
}

type Half = "A" | "B" | "full" | "unknown";
function halfLabel(h: Half): string | null {
  return h === "A" ? "First 7 weeks" : h === "B" ? "Second 7 weeks" : null;
}

function meetingLine(m: Meeting): string {
  if (!m.days.length || m.start == null) return "TBA";
  return `${m.days.join("")} ${fmtTime(m.start)} – ${fmtTime(m.end)}`;
}

function instructorList(s: Section): string[] {
  const names = s.instructors.length ? s.instructors.map((i) => i.name) : (s.instructor_names ?? "").split(/;\s*/);
  const out = names.map((n) => n.trim()).filter(Boolean);
  return out.length ? out : ["Staff"];
}

function rooms(s: Section): string[] {
  if (!s.meetings.length) return ["TBA"];
  return s.meetings.map((m) => m.facility ?? "TBA");
}

/** SIS status icons: green circle = Open, blue square = Closed, yellow triangle = Wait List. */
export function StatusPill({ stat }: { stat: string | null }) {
  const kind = stat === "O" ? "open" : stat === "C" ? "closed" : stat === "W" ? "wait" : "unknown";
  const text = { open: "Open", closed: "Closed", wait: "Wait List", unknown: stat ?? "Unknown" }[kind];
  const tone = {
    open: "text-ok bg-ok/12 border-ok/25",
    closed: "text-accent bg-accent/12 border-accent/25",
    wait: "text-warn bg-warn/12 border-warn/30",
    unknown: "text-muted bg-chip border-line",
  }[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
        {kind === "open" && <circle cx="5" cy="5" r="4.5" fill="currentColor" />}
        {kind === "closed" && <rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor" />}
        {kind === "wait" && <path d="M5 0.6 L9.6 9.2 L0.4 9.2 Z" fill="currentColor" />}
        {kind === "unknown" && <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      </svg>
      {text}
    </span>
  );
}

export function BackupBadge() {
  return <span className="inline-flex items-center rounded-full border border-orange/35 bg-orange/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-ink">Backup</span>;
}

function Seats({ s }: { s: Section }) {
  const open = s.enrollment_available ?? (s.class_capacity != null && s.enrollment_total != null ? s.class_capacity - s.enrollment_total : null);
  return (
    <div className="mono whitespace-nowrap text-xs leading-5">
      <div>{open != null ? `${Math.max(0, open)} of ${s.class_capacity ?? "?"} open` : `${s.class_capacity ?? "?"} seats`}</div>
      <div className="text-muted">{s.enrollment_total != null ? `${s.enrollment_total} enrolled` : ""}</div>
      {(s.wait_tot ?? 0) > 0 && <div className="text-warn">{s.wait_tot} waitlisted</div>}
    </div>
  );
}

function DaysTimes({ s, half }: { s: Section; half: Half }) {
  const hl = halfLabel(half);
  return (
    <div className="space-y-0.5 text-xs leading-5">
      {s.meetings.length ? s.meetings.map((m, i) => {
        const ownDates = (m.start_dt !== s.start_dt || m.end_dt !== s.end_dt) && (m.start_dt || m.end_dt);
        return (
          <div key={i} className="mono whitespace-nowrap">
            {meetingLine(m)}
            {ownDates && <span className="text-muted"> ({fmtDate(m.start_dt)} – {fmtDate(m.end_dt)})</span>}
          </div>
        );
      }) : <div className="mono">TBA</div>}
      {hl && <div className="whitespace-nowrap font-medium text-orange-ink">{hl} · {fmtDate(s.start_dt)} – {fmtDate(s.end_dt)}</div>}
    </div>
  );
}

function Details({ s, half }: { s: Section; half: Half }) {
  const session = s.session_descr ?? (half === "A" ? "First half of term (7 weeks)" : half === "B" ? "Second half of term (7 weeks)" : half === "full" ? "Full term" : null);
  const rows: [string, React.ReactNode][] = [
    ["Grading", s.grading_basis],
    ["Instruction mode", s.instruction_mode_descr],
    ["Session", session],
    ["Dates", s.start_dt || s.end_dt ? `${fmtDate(s.start_dt)} – ${fmtDate(s.end_dt)}${s.end_dt ? `, ${s.end_dt.slice(0, 4)}` : ""}` : null],
    ["School", s.acad_group],
    ["Requirement designation", s.rqmnt_designtn],
  ];
  return (
    <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {rows.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
        <div key={k}><div className="label !text-[11px]">{k}</div><div className="mt-0.5">{v}</div></div>
      ))}
      <div className="sm:col-span-2 lg:col-span-3">
        <div className="label !text-[11px]">Course attributes</div>
        {s.attrs.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {s.attrs.map((a) => { const l = attrLabel(a); return <span key={a} className="chip" title={a}>{l.long}</span>; })}
          </div>
        ) : <div className="mt-0.5 text-muted">None</div>}
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <div className="label !text-[11px]">Reserve capacity</div>
        {s.reserve_caps.length ? (
          <ul className="mt-1 space-y-0.5">
            {s.reserve_caps.map((c, i) => (
              <li key={i} className="text-warn">
                {c.enrl_cap != null && <span className="mono">{c.enrl_cap} seats</span>} reserved for {c.descr ?? "a restricted group"}
                {c.enrl_tot != null && <span className="text-muted"> ({c.enrl_tot} filled)</span>}
              </li>
            ))}
            <li className="text-muted">Seats held for these groups can look open in SIS but not be available to you.</li>
          </ul>
        ) : <div className="mt-0.5 text-muted">No reserved seats. Any eligible student can take an open seat.</div>}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>
      <path d="M4 2.5 L8 6 L4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackupFor({ s, main }: { s: BackupSection; main: Section[] }) {
  if (s.replaces == null) return null;
  const r = main.find((m) => m.class_nbr === s.replaces);
  return <span className="text-[11px] text-orange-ink">for {r ? r.course : "class"} <span className="mono">#{s.replaces}</span></span>;
}

export function CartTable({ sections, term, fresh, conflicted, backup = false, main = [] }: {
  sections: (Section | BackupSection)[];
  term: TermInfo | null;
  fresh: Set<number>;
  conflicted?: Set<number>;
  backup?: boolean;
  main?: Section[];
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (n: number) => setOpen((o) => { const x = new Set(o); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const halves = new Map(sections.map((s) => [s.class_nbr, quarterOf(s, term) as Half]));

  return (
    <>
      {/* phones: one card per section */}
      <ul className="divide-y divide-line/70 md:hidden">
        {sections.map((s) => {
          const bad = conflicted?.has(s.class_nbr);
          const isOpen = open.has(s.class_nbr);
          const half = halves.get(s.class_nbr) ?? "unknown";
          return (
            <li key={s.class_nbr} className={`border-l-[3px] px-4 py-3.5 ${bad ? "border-l-bad bg-bad/5" : "border-l-transparent"} ${fresh.has(s.class_nbr) ? "block-arrive" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{classLabel(s)}</span>
                    {backup && <BackupBadge />}
                  </div>
                  <div className="mt-0.5 text-sm">{s.descr}{s.topic && <span className="text-muted">: {s.topic}</span>}</div>
                  {backup && <BackupFor s={s as BackupSection} main={main} />}
                </div>
                <StatusPill stat={s.enrl_stat} />
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div className="col-span-2"><div className="label !text-[11px]">Days &amp; times</div><DaysTimes s={s} half={half} /></div>
                <div><div className="label !text-[11px]">Room</div><div className="mt-0.5">{rooms(s).join(", ")}</div></div>
                <div><div className="label !text-[11px]">Instructor</div><div className="mt-0.5">{instructorList(s).join(", ")}</div></div>
                <div><div className="label !text-[11px]">Units</div><div className="mono mt-0.5">{s.units ?? "?"}</div></div>
                <div><div className="label !text-[11px]">Seats</div><Seats s={s} /></div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Class Nbr</span>
                  <span className="mono font-semibold">{s.class_nbr}</span>
                  <CopyButton text={String(s.class_nbr)} label="Copy" toastTitle={`Copied #${s.class_nbr}`} className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-accent" />
                </div>
                <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink" aria-expanded={isOpen} onClick={() => toggle(s.class_nbr)}>
                  Details <Chevron open={isOpen} />
                </button>
              </div>
              {isOpen && <div className="mt-3 rounded-xl bg-chip/60 p-3"><Details s={s} half={half} /></div>}
            </li>
          );
        })}
      </ul>

      {/* md and up: the SIS table, scrolling inside its own box if the window is narrow */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              {["Class", "Description", "Days & Times", "Room", "Instructor", "Units", "Status", "Seats", "Class Nbr"].map((h, i) => (
                <th key={h} scope="col" className={`border-b border-line px-3 py-2.5 font-semibold ${i === 0 ? "pl-5" : ""} ${i === 5 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => {
              const bad = conflicted?.has(s.class_nbr);
              const isOpen = open.has(s.class_nbr);
              const half = halves.get(s.class_nbr) ?? "unknown";
              const cell = `px-3 py-3 align-top ${isOpen ? "" : "border-b border-line/70"}`;
              return (
                <Fragment key={s.class_nbr}>
                  <tr className={`${bad ? "bg-bad/5" : "hover:bg-chip/40"} ${fresh.has(s.class_nbr) ? "block-arrive" : ""}`}>
                    <td className={`${cell} border-l-[3px] pl-4 ${bad ? "border-l-bad" : "border-l-transparent"}`}>
                      <button type="button" className="group flex items-start gap-1.5 text-left" aria-expanded={isOpen} onClick={() => toggle(s.class_nbr)} title="Show class details">
                        <span className="mt-1 text-muted group-hover:text-ink"><Chevron open={isOpen} /></span>
                        <span>
                          <span className="block whitespace-nowrap font-semibold group-hover:text-accent">{classLabel(s)}</span>
                          {backup && <span className="mt-1 flex flex-col items-start gap-0.5"><BackupBadge /><BackupFor s={s as BackupSection} main={main} /></span>}
                        </span>
                      </button>
                    </td>
                    <td className={`${cell} min-w-[170px]`}>
                      <div>{s.descr}</div>
                      {s.topic && <div className="text-xs text-muted">{s.topic}</div>}
                    </td>
                    <td className={cell}><DaysTimes s={s} half={half} /></td>
                    <td className={`${cell} text-xs leading-5`}>{rooms(s).map((r, i) => <div key={i} className={r === "TBA" ? "text-muted" : ""}>{r}</div>)}</td>
                    <td className={`${cell} text-xs leading-5`}>{instructorList(s).map((n) => <div key={n} className="whitespace-nowrap">{n}</div>)}</td>
                    <td className={`${cell} mono text-right text-xs`}>{s.units ?? "?"}</td>
                    <td className={cell}><StatusPill stat={s.enrl_stat} /></td>
                    <td className={cell}><Seats s={s} /></td>
                    <td className={`${cell} pr-5`}>
                      <div className="flex items-center gap-1.5">
                        <span className="mono text-xs font-semibold">{s.class_nbr}</span>
                        <CopyButton text={String(s.class_nbr)} label="Copy" toastTitle={`Copied #${s.class_nbr}`} className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted hover:text-accent" />
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={bad ? "bg-bad/5" : ""}>
                      <td colSpan={9} className={`border-b border-l-[3px] border-line/70 px-5 pb-4 pt-1 ${bad ? "border-l-bad" : "border-l-transparent"}`}>
                        <div className="rounded-xl bg-chip/60 p-3.5"><Details s={s} half={half} /></div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
