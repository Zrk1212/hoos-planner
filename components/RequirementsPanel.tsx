"use client";
import type { RequirementStatus, Item } from "@/lib/requirements";

function St({ item, label }: { item: Item; label: string }) {
  const txt = { done: "done", in_progress: "in progress", planned: "in cart", missing: "needed" }[item.status];
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 border-b border-line/60 last:border-0">
      <span className="text-sm">{label}</span>
      <span className={`text-xs text-right status-${item.status}`} title={item.note}>
        {txt}{item.by ? <span className="text-muted"> · {item.by}</span> : null}
      </span>
    </div>
  );
}

export function RequirementsPanel({ st, compact = false }: { st: RequirementStatus; compact?: boolean }) {
  const c = st.credits;
  return (
    <div className={`grid gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
      <section className="card p-4">
        <div className="label mb-1">Engagements <span className="text-muted font-normal normal-case">(2 per semester max)</span></div>
        {st.engagements.areas.map((a) => <St key={a.nbr} item={a.item} label={`EGMT ${a.nbr} ${a.name}`} />)}
        {st.engagements.warnings.map((w) => <p key={w} className="text-xs text-warn mt-1">{w}</p>)}
      </section>
      <section className="card p-4">
        <div className="label mb-1">Literacies</div>
        <St item={st.literacies.fwr} label="First Writing" />
        <St item={st.literacies.swr} label="Second Writing" />
        <St item={st.literacies.worldLanguage} label="World Language" />
        <St item={st.literacies.qcd.item} label={`QCD (${st.literacies.qcd.courses.filter((q) => q.status === "done").length} of 2)`} />
      </section>
      <section className="card p-4">
        <div className="label mb-1">Disciplines <span className="text-muted font-normal normal-case">({st.disciplines.departments.length} of ≥6 departments)</span></div>
        {st.disciplines.areas.map((a) => <St key={a.code} item={a.item} label={`${a.code} · ${a.name}`} />)}
        {Object.entries(st.disciplines.alternatives).length > 0 && (
          <p className="text-xs text-muted mt-1">Counts for one category only: {Object.entries(st.disciplines.alternatives).map(([c, cats]) => `${c} (${cats.join(" or ")})`).join("; ")}</p>
        )}
        {st.disciplines.warnings.map((w) => <p key={w} className="text-xs text-warn mt-1">{w}</p>)}
      </section>
      <section className="card p-4">
        <div className="label mb-1">Credits & applications</div>
        <div className="grid grid-cols-2 gap-x-3 text-sm">
          <span className="text-muted">Earned</span><span className="mono text-right">{c.earned} <span className="text-muted text-xs">({c.test} test)</span></span>
          <span className="text-muted">In progress</span><span className="mono text-right">{c.inProgress}</span>
          <span className="text-muted">In cart</span><span className="mono text-right">{c.planned}</span>
          <span className="text-muted">Projected</span><span className="mono text-right font-medium">{c.projected}</span>
          <span className="text-muted">Non-College</span><span className={`mono text-right ${c.nonCollege > c.nonCollegeMax ? "text-warn" : ""}`}>{c.nonCollege} / {c.nonCollegeMax}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-line/60">
          <div className="text-xs font-medium mb-0.5">McIntire <span className={st.mcintire.ready ? "status-done" : "text-muted"}>{st.mcintire.ready ? "· on track" : ""}</span></div>
          <St item={st.mcintire.comm1800} label="COMM 1800" />
          <St item={st.mcintire.econ2010} label="ECON 2010" />
          <St item={st.mcintire.fwr} label="First Writing" />
          <div className="flex justify-between text-xs py-1"><span>24 graded UVA credits</span><span className="mono">{st.mcintire.gradedUvaCredits.have} now · {st.mcintire.gradedUvaCredits.projected} projected</span></div>
        </div>
        <div className="mt-2 pt-2 border-t border-line/60">
          <div className="text-xs font-medium mb-0.5">School of Data Science <span className={st.sds.ready ? "status-done" : "text-muted"}>{st.sds.ready ? "· on track" : ""}</span></div>
          <St item={st.sds.ds1001} label="DS 1001 (C- or better, at UVA)" />
          <St item={st.sds.programming} label="Programming (DS 1002 / CS 111x / AP CS A)" />
          <div className="flex justify-between text-xs py-1"><span>24 UVA credits</span><span className="mono">{st.sds.uvaCredits.have} now · {st.sds.uvaCredits.projected} projected</span></div>
          {st.sds.notes.filter((n) => /Principles|cannot/.test(n)).map((n) => <p key={n} className="text-xs text-warn">{n}</p>)}
        </div>
      </section>
      {st.warnings.length > 0 && (
        <section className="md:col-span-2 text-xs text-warn">{st.warnings.map((w) => <p key={w}>{w}</p>)}</section>
      )}
    </div>
  );
}
