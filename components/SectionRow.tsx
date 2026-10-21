"use client";
import { fmtMeetings } from "@/lib/meetings";
import type { ScoredSection } from "@/lib/search";

export function SectionRow({ x, inCart, onToggle, fills, conflict }: { x: ScoredSection; inCart: boolean; onToggle: () => void; fills?: string[]; conflict?: string | null }) {
  const s = x.section;
  const r = x.rating;
  const open = s.enrollment_available ?? null;
  return (
    <div className={`card p-3.5 flex gap-3 min-w-0 transition-[border-color,box-shadow] duration-200 hover:border-accent/40 ${conflict ? "opacity-70" : ""} ${inCart ? "!border-accent shadow-[0_0_0_3px_rgb(var(--accent-glow)/0.15)]" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{s.course}</span>
          <span className="text-muted text-sm truncate">{s.descr}{s.topic ? ` · ${s.topic}` : ""}</span>
        </div>
        <div className="text-sm mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="mono">{fmtMeetings(s.meetings)}</span>
          {x.quarter === "A" && <span className="chip">1st half</span>}
          {x.quarter === "B" && <span className="chip">2nd half</span>}
          <span className="text-muted">{s.instructor_names ?? "TBA"}</span>
          <span className="text-muted">{s.units} cr · {s.component}-{s.class_section}</span>
          <span className={`text-muted ${open !== null && open <= 0 ? "text-bad" : ""}`}>{open ?? "?"}/{s.class_capacity ?? "?"} open{(s.wait_tot ?? 0) > 0 ? ` · ${s.wait_tot} waiting` : ""}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {s.attrs.filter((a) => a.startsWith("ASU")).map((a) => <span key={a} className="chip">{a.replace(/^ASU[DRQW]-/, "").replace("R21C2", "2nd Writing").replace("R21C1", "1st Writing")}</span>)}
          {s.grading_basis === "Credit/No Credit" && <span className="chip">CR/NC</span>}
          {s.reserve_caps.length > 0 && <span className="chip text-warn" title={s.reserve_caps.map((c) => c.descr).join("; ")}>reserve caps</span>}
          {s.rqmnt_designtn && <span className="chip text-warn">req {s.rqmnt_designtn}</span>}
          {s.enrl_stat && s.enrl_stat !== "O" && <span className="chip text-bad">{s.enrl_stat === "W" ? "waitlist" : s.enrl_stat === "C" ? "closed" : s.enrl_stat}</span>}
          {fills?.map((f) => <span key={f} className={`chip ${/needed|\(\)/.test(f) || !/done|already|nothing new|no gen-ed/.test(f) ? "bg-ok/15 text-ok" : ""}`}>{f}</span>)}
        </div>
        {conflict && <div className="text-xs text-bad mt-1">conflicts with {conflict}</div>}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <div className="mono text-xs text-right" title={r ? `Course Forum ${x.ratingLevel === "course" ? "course average" : "this instructor"}: rating / difficulty / GPA` : "no Course Forum data"}>
          {r ? (
            <>
              <div><span className="text-muted">rate</span> {r.rating ?? "–"}</div>
              <div><span className="text-muted">diff</span> <span className={r.difficulty != null && r.difficulty <= 2 ? "text-ok" : r.difficulty != null && r.difficulty >= 3.5 ? "text-bad" : ""}>{r.difficulty ?? "–"}</span></div>
              <div><span className="text-muted">gpa</span> {r.gpa ?? "–"}</div>
              {x.ratingLevel === "course" && <div className="text-muted">(course avg)</div>}
            </>
          ) : <div className="text-muted">no reviews</div>}
        </div>
        <button className={`btn btn-sm ${inCart ? "" : "btn-primary"}`} onClick={onToggle}>{inCart ? "Remove" : "Add"}</button>
        <span className="mono text-[11px] text-muted">#{s.class_nbr}</span>
      </div>
    </div>
  );
}
