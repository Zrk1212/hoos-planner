"use client";
import { useMemo, useState } from "react";
import { parseAudit } from "@/lib/audit-parser";
import { buildAcadGroupIndex, buildAttrIndex, evaluate } from "@/lib/requirements";
import { useCatalog, usePlan } from "@/lib/plan-store";
import type { CourseStatus, ProfileCourse, Section } from "@/lib/types";
import { RequirementsPanel } from "@/components/RequirementsPanel";
import { RequirementsSkeleton } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";

const STATUSES: CourseStatus[] = ["completed", "in_progress", "test", "transfer", "planned"];

const SAMPLE = `Program: Arts & Sciences Undeclared — Engagements Pathway
EGMT 1510 Engaging Aesthetics 2 A- Fall 2026 COMPLETED
EGMT 1520 Empirical Engagement 2 Fall 2026 CURRENTLY TAKING
ENWR 1510 Writing and Critical Inquiry 3 Fall 2026 CURRENTLY TAKING
COMM 1800 Foundations of Commerce 3 Fall 2026 CURRENTLY TAKING
ECON 2010 Principles of Microeconomics 3 Fall 2026 CURRENTLY TAKING
MATH 1310 Calculus I 4 TE TRANSFERRED
BIOL 2200 Organismal Biology 4 TE TRANSFERRED
ECON 2020 Principles of Macroeconomics 3 TE TRANSFERRED
AP Calculus AB (5)
World Language: satisfied by placement (SPAN 3010P)`;

export default function AuditPage() {
  const { plan, setProfile, ready } = usePlan();
  const { catalog } = useCatalog();
  const [text, setText] = useState("");
  const { toast } = useToast();
  const profile = plan.profile;

  const indexes = useMemo(() => {
    const secs: Section[] = catalog?.sections ?? [];
    return { attrIndex: buildAttrIndex(secs), acadGroups: buildAcadGroupIndex(secs), byNbr: new Map(secs.map((s) => [s.class_nbr, s])) };
  }, [catalog]);
  const status = useMemo(() => {
    if (!profile) return null;
    const planned = plan.cart.map((c) => indexes.byNbr.get(c.class_nbr)).filter((s): s is Section => !!s);
    return evaluate({ profile, attrIndex: indexes.attrIndex, acadGroups: indexes.acadGroups, planned, plannedTermName: catalog?.term.name });
  }, [profile, catalog, plan.cart, indexes]);

  function parse() {
    if (!text.trim()) return;
    const p = parseAudit(text);
    setProfile(p);
    const n = p.courses.length;
    toast(n > 0
      ? { kind: "ok", title: `Parsed ${n} course${n === 1 ? "" : "s"}`, body: p.tests.length ? `Plus ${p.tests.length} exam score${p.tests.length === 1 ? "" : "s"}. Check the table, then see where you stand.` : "Check the table, then see where you stand." }
      : { kind: "error", title: "No courses found in that text", body: "Copy the whole Stellic audit page (select all), or try the sample to see the format." });
  }
  function updateCourse(i: number, patch: Partial<ProfileCourse>) {
    if (!profile) return;
    const courses = profile.courses.map((c, k) => (k === i ? { ...c, ...patch } : c));
    setProfile({ ...profile, courses });
  }
  function removeCourse(i: number) { if (profile) setProfile({ ...profile, courses: profile.courses.filter((_, k) => k !== i) }); }
  function addRow() {
    if (!profile) return;
    setProfile({ ...profile, courses: [...profile.courses, { course: "", credits: 3, status: "completed" }] });
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
      <div>
        <h1 className="h-page">Paste your audit</h1>
        <p className="text-sm text-muted mt-1">
          Open Stellic (or SIS → Academics → Unofficial Transcript), select all, copy, paste here. We read course codes, credits, grades,
          <em> CURRENTLY TAKING</em> rows, <em>TRANSFERRED … TE</em> rows and AP scores. The text stays in your browser (and your account, if signed in).
        </p>
        <textarea className="input w-full mt-3 h-72 !rounded-2xl p-3" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste Stellic audit or SIS transcript text…" />
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary" onClick={parse} disabled={!text.trim()}>Parse</button>
          <button className="btn" onClick={() => setText(SAMPLE)}>Load sample</button>
          {profile && <button className="btn" onClick={() => setProfile(null)}>Clear profile</button>}
        </div>
        {profile && (
          <div className="card mt-4 p-4">
            <div className="flex items-center justify-between">
              <div className="label">Parsed profile <span className="normal-case font-normal text-muted">({profile.sourceFormat}{profile.program ? ` · ${profile.program}` : ""})</span></div>
              <button className="btn btn-sm" onClick={addRow}>+ row</button>
            </div>
            {profile.notes.map((n) => <p key={n} className="text-xs text-warn mt-1">{n}</p>)}
            <div className="overflow-x-auto"><table className="w-full text-sm mt-2">
              <thead className="text-xs text-muted text-left"><tr><th>Course</th><th>Cr</th><th>Grade</th><th>Status</th><th>Term</th><th /></tr></thead>
              <tbody>
                {profile.courses.map((c, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="py-1 pr-1"><input className="input w-24 mono py-0.5" value={c.course} onChange={(e) => updateCourse(i, { course: e.target.value.toUpperCase() })} /></td>
                    <td className="pr-1"><input className="input w-12 mono py-0.5" value={c.credits} onChange={(e) => updateCourse(i, { credits: parseFloat(e.target.value) || 0 })} /></td>
                    <td className="pr-1"><input className="input w-12 mono py-0.5" value={c.grade ?? ""} onChange={(e) => updateCourse(i, { grade: e.target.value.toUpperCase() || undefined })} /></td>
                    <td className="pr-1">
                      <select className="input py-0.5" value={c.status} onChange={(e) => updateCourse(i, { status: e.target.value as CourseStatus })}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    </td>
                    <td className="text-xs text-muted">{c.term ?? ""}</td>
                    <td><button className="text-muted hover:text-bad text-xs" onClick={() => removeCourse(i)} title="remove" aria-label={`remove ${c.course}`}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {profile.tests.length > 0 && <p className="text-xs text-muted mt-2">Exams: {profile.tests.map((t) => `${t.exam} ${t.score}`).join(" · ")}</p>}
            <label className="flex items-center gap-2 text-xs mt-2">
              <input type="checkbox" checked={profile.worldLanguagePlacement} onChange={(e) => setProfile({ ...profile, worldLanguagePlacement: e.target.checked })} />
              World Language satisfied by placement / exemption
            </label>
          </div>
        )}
      </div>
      <div>
        <h2 className="h-page">Where you stand</h2>
        <p className="text-sm text-muted mt-1">Engagements Pathway rules from the 2026-27 Record, plus McIntire and SDS prerequisites. Cart items count as “in cart”.</p>
        <div className="mt-3">
          {!ready ? <RequirementsSkeleton />
            : status ? <RequirementsPanel st={status} />
            : <div className="card !rounded-[22px] p-8 text-center">
                <div className="font-medium">Your requirements show up here</div>
                <p className="mt-1 text-sm text-muted">Paste your audit and choose Parse, or load the sample to see how it reads.</p>
              </div>}
        </div>
      </div>
    </div>
  );
}
