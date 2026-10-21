"use client";
import { useEffect, useMemo, useState } from "react";
import { buildAcadGroupIndex, buildAttrIndex, evaluate, whatItSatisfies } from "@/lib/requirements";
import { searchSections, type SearchOptions } from "@/lib/search";
import { sectionsConflict } from "@/lib/meetings";
import { useCatalog, usePlan } from "@/lib/plan-store";
import { DISCIPLINES, ENGAGEMENTS, type DayCode, type Section } from "@/lib/types";
import { SectionRow } from "@/components/SectionRow";
import { CartPanel } from "@/components/CartPanel";
import { BuilderSkeleton } from "@/components/Skeletons";

const DAYS: DayCode[] = ["Mo", "Tu", "We", "Th", "Fr"];
const TIMES = [["any", ""], ["8:00", "480"], ["9:00", "540"], ["9:30", "570"], ["10:00", "600"], ["11:00", "660"], ["12:00", "720"], ["12:30", "750"], ["1:00 pm", "780"], ["2:00 pm", "840"], ["3:00 pm", "900"]];

export default function BuilderPage() {
  const { plan, toggleCart, removeFromCart, clearCart } = usePlan();
  const { catalog, error } = useCatalog();
  const [query, setQuery] = useState("");
  const [disc, setDisc] = useState<string>("");
  const [egmt, setEgmt] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [earliest, setEarliest] = useState<string>("");
  const [days, setDays] = useState<DayCode[]>([]);
  const [maxDiff, setMaxDiff] = useState<string>("");
  const [collegeOnly, setCollegeOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(true);
  const [hideConflicts, setHideConflicts] = useState(true);
  const [includeUnrated, setIncludeUnrated] = useState(false);
  const [swr, setSwr] = useState(false);
  const [qcd, setQcd] = useState(false);
  const [limit, setLimit] = useState(60);

  const byNbr = useMemo(() => new Map((catalog?.sections ?? []).map((s) => [s.class_nbr, s])), [catalog]);
  const cart = useMemo(() => plan.cart.map((c) => byNbr.get(c.class_nbr)).filter((s): s is Section => !!s), [plan.cart, byNbr]);
  const unknownCart = useMemo(() => (catalog ? plan.cart.map((c) => c.class_nbr).filter((n) => !byNbr.has(n)) : []), [plan.cart, byNbr, catalog]);
  const cartSet = useMemo(() => new Set(cart.map((s) => s.class_nbr)), [cart]);

  const indexes = useMemo(() => (catalog ? { attrIndex: buildAttrIndex(catalog.sections), acadGroups: buildAcadGroupIndex(catalog.sections) } : null), [catalog]);
  const status = useMemo(() => {
    if (!catalog || !plan.profile || !indexes) return null;
    return evaluate({ profile: plan.profile, ...indexes, planned: cart, plannedTermName: catalog.term.name });
  }, [catalog, plan.profile, cart, indexes]);
  useEffect(() => { setLimit(60); }, [query, disc, swr, qcd, egmt, quarter, earliest, days, maxDiff, collegeOnly, openOnly, hideConflicts, includeUnrated]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const attrs: string[] = [];
    if (disc) attrs.push(disc);
    if (swr) attrs.push("SWR");
    if (qcd) attrs.push("QCD");
    const opts: SearchOptions = {
      query: query || undefined, attrs, engagement: (egmt || undefined) as SearchOptions["engagement"],
      quarter: (quarter || undefined) as SearchOptions["quarter"], earliestStart: earliest ? parseInt(earliest, 10) : undefined,
      days: days.length ? days : undefined, maxDifficulty: maxDiff ? parseFloat(maxDiff) : undefined, collegeOnly, openOnly,
      includeTba: !earliest && !days.length, includeUnrated,
    };
    const hasFilter = query || attrs.length || egmt || quarter || earliest || days.length || maxDiff;
    if (!hasFilter) return [];
    return searchSections(catalog.sections, catalog.ratings, catalog.term, opts).map((x) => {
      let conflict: string | null = null;
      for (const c of cart) { if (c.class_nbr !== x.section.class_nbr && sectionsConflict(x.section, c)) { conflict = `${c.course} #${c.class_nbr}`; break; } }
      return { ...x, conflictsWith: conflict };
    }).filter((x) => !hideConflicts || !x.conflictsWith || cartSet.has(x.section.class_nbr));
  }, [catalog, query, disc, swr, qcd, egmt, quarter, earliest, days, maxDiff, collegeOnly, openOnly, hideConflicts, includeUnrated, cart, cartSet]);

  if (error) return (
    <div className="card mx-auto max-w-lg p-6 text-center" role="alert">
      <h1 className="h-page">The catalog didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">{error}. Your cart is saved on this device; reload to try again.</p>
      <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Reload</button>
    </div>
  );
  if (!catalog) return <BuilderSkeleton />;

  const needed = status ? { disc: status.disciplines.unmet, egmt: status.engagements.remaining, swr: status.literacies.swr.status === "missing", qcd: status.literacies.qcd.item.status !== "done" } : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_320px] gap-5 min-w-0">
      <aside className="min-w-0 lg:col-start-3 lg:row-start-1">
        <CartPanel cart={cart} unknown={unknownCart} term={catalog.term} onRemove={removeFromCart} onClear={clearCart} />
      </aside>
      <aside className="space-y-3 min-w-0 lg:col-start-1 lg:row-start-1">
        <div className="text-xs text-muted">{catalog.term.name} · {catalog.sections.length.toLocaleString()} sections · snapshot {catalog.term.synced_at ? new Date(catalog.term.synced_at).toLocaleDateString() : "seed"}</div>
        <input className="input w-full" aria-label="Search sections" placeholder="Search: PHIL, DS 1002, beatles, 14431…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div>
          <div className="label mb-1">Discipline {needed && needed.disc.length > 0 && <span className="normal-case font-normal text-muted">(owed: {needed.disc.join(", ")})</span>}</div>
          <select className="input w-full" aria-label="Discipline" value={disc} onChange={(e) => setDisc(e.target.value)}>
            <option value="">any</option>
            {Object.entries(DISCIPLINES).map(([c, n]) => <option key={c} value={c}>{c} · {n}{needed?.disc.includes(c as never) ? " ★" : ""}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="label mb-1">Engagement {needed && needed.egmt.length > 0 && <span className="normal-case font-normal text-muted">(owed: {needed.egmt.join(", ")})</span>}</div>
            <select className="input w-full" aria-label="Engagement area" value={egmt} onChange={(e) => setEgmt(e.target.value)}>
              <option value="">—</option>
              {Object.entries(ENGAGEMENTS).map(([c, n]) => <option key={c} value={c}>{c} {n}{needed?.egmt.includes(c as never) ? " ★" : ""}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1">Half</div>
            <select className="input" aria-label="Term half" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
              <option value="">any</option><option value="A">1st (Q3)</option><option value="B">2nd (Q4)</option><option value="full">full</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={swr} onChange={(e) => setSwr(e.target.checked)} /> 2nd Writing{needed?.swr ? " ★" : ""}</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={qcd} onChange={(e) => setQcd(e.target.checked)} /> QCD{needed?.qcd ? " ★" : ""}</label>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="label mb-1">Earliest start</div>
            <select className="input w-full" aria-label="Earliest start" value={earliest} onChange={(e) => setEarliest(e.target.value)}>{TIMES.map(([l, v]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div className="flex-1">
            <div className="label mb-1">Max difficulty</div>
            <select className="input w-full" aria-label="Max difficulty" value={maxDiff} onChange={(e) => setMaxDiff(e.target.value)}>
              <option value="">any</option><option value="1.5">≤ 1.5</option><option value="2">≤ 2</option><option value="2.5">≤ 2.5</option><option value="3">≤ 3</option>
            </select>
          </div>
        </div>
        <div>
          <div className="label mb-1">Days (only these)</div>
          <div className="flex gap-1">
            {DAYS.map((d) => (
              <button key={d} aria-pressed={days.includes(d)} className={`btn btn-sm ${days.includes(d) ? "btn-primary" : ""}`} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>{d}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={collegeOnly} onChange={(e) => setCollegeOnly(e.target.checked)} /> College credit only</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open sections only</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={hideConflicts} onChange={(e) => setHideConflicts(e.target.checked)} /> Hide conflicts with cart</label>
          {maxDiff && <label className="flex items-center gap-1.5"><input type="checkbox" checked={includeUnrated} onChange={(e) => setIncludeUnrated(e.target.checked)} /> Include sections with no reviews</label>}
        </div>
        {!plan.profile && <p className="text-xs text-muted">Paste your audit to see what each section fills.</p>}
      </aside>

      <section className="min-w-0 lg:col-start-2 lg:row-start-1">
        {results.length === 0 ? (
          <div className="card !rounded-[22px] p-8 text-center">
            <div className="font-medium">Pick a filter or search to see sections</div>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">Results rank easiest first: Course Forum difficulty, then rating, then GPA. Starred options are ones your audit says you still owe.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted">{results.length} sections · easiest first</div>
            {results.slice(0, limit).map((x) => (
              <SectionRow key={x.section.class_nbr} x={x} inCart={cartSet.has(x.section.class_nbr)} onToggle={() => toggleCart(x.section.class_nbr)}
                fills={status ? whatItSatisfies(x.section, status) : undefined} conflict={x.conflictsWith} />
            ))}
            {results.length > limit && <button className="btn w-full justify-center" onClick={() => setLimit(limit + 60)}>Show more ({results.length - limit} left)</button>}
          </div>
        )}
      </section>

    </div>
  );
}
