"use client";
/**
 * The plan Claude is building, shared by the Schedule, Cart and Requirements pages.
 * The active code comes from plan-code.ts (issued by the site, or ?plan= from Claude's link). The row is re-read
 * every few seconds while the tab is visible, so each save_plan in the chat shows up on its own. Until Claude's
 * first save the code has no row (404): the page waits on it rather than calling it broken.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { buildAcadGroupIndex, buildAttrIndex, evaluate, type RequirementStatus } from "@/lib/requirements";
import { findConflicts, type Conflict } from "@/lib/meetings";
import { useCatalog } from "@/lib/plan-store";
import type { Catalog } from "@/lib/catalog-types";
import type { Goal, PlanCartItem, PlanRow } from "@/lib/plan-schema";
import type { Section } from "@/lib/types";
import { resetPlanCode, usePlanCode } from "./plan-code";

const POLL_MS = 3000;

export type LiveState = { kind: "loading" } | { kind: "waiting"; deleted?: boolean } | { kind: "error"; msg: string } | { kind: "ok"; row: PlanRow };
export type BackupSection = Section & { replaces?: number };

export interface ActivePlan {
  code: string | null;
  state: LiveState;
  row: PlanRow | null;
  catalog: Catalog | null;
  catalogError: string | null;
  /** main schedule, in saved order */
  main: Section[];
  backups: BackupSection[];
  /** class numbers no longer in the catalog */
  unknown: number[];
  conflicts: Conflict[];
  status: RequirementStatus | null;
  goals: Goal[];
  /** class numbers that arrived with the latest save (for a one-time highlight) */
  fresh: Set<number>;
  shareUrl: string;
  /** a fresh, empty plan for this browser */
  startOver: () => void;
}

type Details = Pick<Section, "section_type" | "acad_org" | "session_descr" | "instruction_mode_descr" | "wait_cap" | "instructors" | "meetings">;

/** Rooms, instructors and session details for the plan's sections, which the catalog download leaves out. */
function useSectionDetails(term: string | undefined, cart: PlanCartItem[] | undefined) {
  const [map, setMap] = useState<Map<number, Details>>(new Map());
  const key = (cart ?? []).map((c) => c.class_nbr).sort().join(",");
  useEffect(() => {
    if (!term || !key) return;
    const missing = key.split(",").filter((n) => !map.has(Number(n)));
    if (!missing.length) return;
    let alive = true;
    fetch(`/api/sections?term=${term}&nbrs=${missing.join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { sections: Array<Details & { class_nbr: number }> } | null) => {
        if (!alive || !j) return;
        setMap((m) => { const next = new Map(m); for (const { class_nbr, ...d } of j.sections) next.set(class_nbr, d); return next; });
      })
      .catch(() => { /* rooms stay TBA */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, key]);
  return map;
}

export function useActivePlan(): ActivePlan {
  const code = usePlanCode(); // null until read on the client
  const [state, setState] = useState<LiveState>({ kind: "loading" });
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!code) return;
    last.current = null;
    setState({ kind: "loading" });
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined, delay = POLL_MS;
    async function tick() {
      if (document.hidden) { timer = setTimeout(tick, POLL_MS); return; }
      try {
        const r = await fetch(`/api/plans?code=${code}&soft=1`, { cache: "no-store" });
        if (!alive) return;
        if (r.status === 404) setState({ kind: "waiting" });
        else if (r.status === 429) { delay = Math.min(delay * 2, 30_000); setState((s) => (s.kind === "ok" ? s : { kind: "error", msg: "busy" })); }
        else if (!r.ok) setState((s) => (s.kind === "ok" ? s : { kind: "error", msg: `plans ${r.status}` }));
        else {
          delay = POLL_MS;
          const row = (await r.json()) as PlanRow | { missing: true };
          if ("missing" in row) { const had = last.current !== null; last.current = null; setState((s) => ({ kind: "waiting", deleted: had || (s.kind === "waiting" && s.deleted) })); }
          else if (row.updated_at !== last.current) { last.current = row.updated_at; setState({ kind: "ok", row }); }
        }
      } catch (e) {
        if (alive) setState((s) => (s.kind === "ok" ? s : { kind: "error", msg: (e as Error).message }));
      }
      if (alive) timer = setTimeout(tick, delay);
    }
    tick();
    const wake = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", wake);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", wake); };
  }, [code]);

  const { catalog, error: catalogError } = useCatalog();
  const row = state.kind === "ok" ? state.row : null;
  const details = useSectionDetails(catalog?.term.code, row?.cart);
  const byNbr = useMemo(() => new Map((catalog?.sections ?? []).map((s) => [s.class_nbr, details.get(s.class_nbr) ? { ...s, ...details.get(s.class_nbr) } : s])), [catalog, details]);
  const items: PlanCartItem[] = useMemo(() => row?.cart ?? [], [row]);
  const main = useMemo(() => items.filter((i) => !i.backup).map((i) => byNbr.get(i.class_nbr)).filter((s): s is Section => !!s), [items, byNbr]);
  const backups = useMemo(() => items.filter((i) => i.backup).flatMap((i) => { const s = byNbr.get(i.class_nbr); return s ? [{ ...s, replaces: i.replaces }] : []; }), [items, byNbr]);
  const unknown = useMemo(() => (catalog ? items.map((i) => i.class_nbr).filter((n) => !byNbr.has(n)) : []), [items, byNbr, catalog]);
  const conflicts = useMemo(() => findConflicts(main), [main]);
  const status = useMemo(() => {
    if (!catalog || !row?.profile) return null;
    return evaluate({ profile: row.profile, attrIndex: buildAttrIndex(catalog.sections), acadGroups: buildAcadGroupIndex(catalog.sections), planned: main, plannedTermName: catalog.term.name });
  }, [catalog, row, main]);
  const goals = row?.meta?.goals?.length ? row.meta.goals : (["college"] as Goal[]);

  // sections that arrived since the previous save pulse once
  const seen = useRef<{ code: string; nbrs: Set<number> } | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!catalog || !row || !code) return;
    const now = new Set(items.map((i) => i.class_nbr));
    const prev = seen.current?.code === code ? seen.current.nbrs : null; // a different plan isn't "new sections"
    seen.current = { code, nbrs: now };
    if (!prev) return;
    const added = new Set([...now].filter((n) => !prev.has(n)));
    if (!added.size) return;
    setFresh(added);
    const t = setTimeout(() => setFresh(new Set()), 2600);
    return () => clearTimeout(t);
  }, [items, catalog, row, code]);

  const shareUrl = code && typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?plan=${code}` : "";
  const startOver = () => { resetPlanCode(); };

  return { code, state: code ? state : { kind: "loading" }, row, catalog, catalogError, main, backups, unknown, conflicts, status, goals, fresh, shareUrl, startOver };
}
