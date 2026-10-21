"use client";
/**
 * Client-side plan state: profile + cart + filters for the active term.
 * - Always persisted to localStorage under a key scoped to the signed-in user (or "anon").
 * - Mirrored to public.user_plans when signed in (RLS: own rows only). Newer side wins by updatedAt;
 *   a failed remote read is an error, never "no plan", so local state can't clobber the server.
 * - Sign-out wipes the in-memory plan and that user's local copy (shared computers).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { browserClient } from "./supabase/client";
import type { CartItem, Plan, Profile } from "./types";
import type { Catalog } from "./catalog-types";
import { hydrateRatings, hydrateRow, type WireCatalog } from "./catalog-wire";

const TERM = process.env.NEXT_PUBLIC_DEFAULT_TERM ?? "1272";
const keyFor = (uid: string | null) => `hp:plan:${TERM}:${uid ?? "anon"}`;

interface StoredPlan extends Plan { updatedAt?: string; dirty?: boolean }

interface PlanCtx {
  plan: Plan;
  term: string;
  user: User | null;
  ready: boolean;
  syncState: "idle" | "saving" | "error";
  setProfile: (p: Profile | null) => void;
  addToCart: (class_nbr: number, note?: string) => void;
  removeFromCart: (class_nbr: number) => void;
  toggleCart: (class_nbr: number) => void;
  clearCart: () => void;
  setFilters: (f: Record<string, unknown>) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<PlanCtx | null>(null);

const empty = (): StoredPlan => ({ term: TERM, name: "My plan", profile: null, cart: [], filters: {}, dirty: false });
const hasContent = (p: Plan) => !!p.profile || p.cart.length > 0;

function readLocal(uid: string | null): StoredPlan | null {
  try {
    let raw = localStorage.getItem(keyFor(uid));
    if (!raw && uid === null) {
      // pre-2026-10-21 key without a user scope: migrate once
      const legacy = `hp:plan:${TERM}`;
      raw = localStorage.getItem(legacy);
      if (raw) { localStorage.setItem(keyFor(null), raw); localStorage.removeItem(legacy); }
    }
    return raw ? { ...empty(), ...(JSON.parse(raw) as StoredPlan) } : null;
  } catch { return null; }
}
function writeLocal(uid: string | null, p: StoredPlan) {
  try { localStorage.setItem(keyFor(uid), JSON.stringify(p)); } catch { /* storage unavailable */ }
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<StoredPlan>(empty);
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = auth not resolved yet
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "saving" | "error">("idle");
  const supabase = useMemo(() => (typeof window === "undefined" ? null : browserClient()), []);
  const remoteLoadedFor = useRef<string | null>(null);
  const uid = user?.id ?? null;

  // auth: resolve the current user and follow changes (other tabs included)
  useEffect(() => {
    if (!supabase) { setUser(null); return; }
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e: string, s: Session | null) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // local load whenever the user identity changes
  useEffect(() => {
    if (user === undefined) return;
    let local = readLocal(uid);
    if (!local && uid) {
      // first sign-in on this device: carry over anonymous work
      const anon = readLocal(null);
      if (anon && hasContent(anon)) local = { ...anon, dirty: true };
    }
    setPlan(local ?? empty());
    remoteLoadedFor.current = null;
    setReady(true);
  }, [user, uid]);

  // local save
  useEffect(() => {
    if (!ready || user === undefined) return;
    writeLocal(uid, plan);
  }, [plan, ready, uid, user]);

  // remote load once per signed-in user: newer side wins; errors never count as "no plan"
  useEffect(() => {
    if (!supabase || !uid || !ready || remoteLoadedFor.current === uid) return;
    remoteLoadedFor.current = uid;
    (async () => {
      const { data, error } = await supabase.from("user_plans").select("id,profile,cart,filters,updated_at").eq("user_id", uid).eq("term", TERM).eq("name", "My plan").maybeSingle();
      if (error) { setSyncState("error"); remoteLoadedFor.current = null; return; }
      if (!data) {
        if (hasContent(plan)) setPlan((p) => ({ ...p, dirty: true }));
        return;
      }
      const remote: StoredPlan = { term: TERM, name: "My plan", id: data.id, profile: data.profile as Profile | null, cart: (data.cart as CartItem[]) ?? [], filters: (data.filters as Record<string, unknown>) ?? {}, updatedAt: data.updated_at, dirty: false };
      const localNewer = plan.dirty && plan.updatedAt && data.updated_at && plan.updatedAt > data.updated_at;
      if (localNewer) setPlan((p) => ({ ...p, id: data.id, dirty: true }));
      else setPlan(remote);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, uid, ready]);

  // remote save (debounced) when signed in and dirty
  useEffect(() => {
    if (!supabase || !uid || !ready || !plan.dirty || remoteLoadedFor.current !== uid) return;
    const t = setTimeout(async () => {
      setSyncState("saving");
      const { error } = await supabase.from("user_plans").upsert(
        { user_id: uid, term: TERM, name: "My plan", profile: plan.profile, cart: plan.cart, filters: plan.filters ?? {} },
        { onConflict: "user_id,term,name" },
      );
      setSyncState(error ? "error" : "idle");
      if (!error) setPlan((p) => (p.updatedAt === plan.updatedAt ? { ...p, dirty: false } : p));
    }, 800);
    return () => clearTimeout(t);
  }, [supabase, uid, ready, plan]);

  const update = useCallback((fn: (p: Plan) => Plan) => {
    setPlan((p) => ({ ...fn(p), dirty: true, updatedAt: new Date().toISOString() }));
  }, []);

  const signOut = useCallback(async () => {
    const current = uid;
    await supabase?.auth.signOut();
    try { if (current) localStorage.removeItem(keyFor(current)); } catch { /* ignore */ }
    remoteLoadedFor.current = null;
    setPlan(empty());
    setUser(null);
  }, [supabase, uid]);

  const value = useMemo<PlanCtx>(() => ({
    plan, term: TERM, user: user ?? null, ready, syncState,
    setProfile: (profile) => update((p) => ({ ...p, profile })),
    addToCart: (class_nbr, note) => update((p) => (p.cart.some((c) => c.class_nbr === class_nbr) ? p : { ...p, cart: [...p.cart, { class_nbr, note }] })),
    removeFromCart: (class_nbr) => update((p) => ({ ...p, cart: p.cart.filter((c) => c.class_nbr !== class_nbr) })),
    toggleCart: (class_nbr) => update((p) => (p.cart.some((c) => c.class_nbr === class_nbr) ? { ...p, cart: p.cart.filter((c) => c.class_nbr !== class_nbr) } : { ...p, cart: [...p.cart, { class_nbr }] })),
    clearCart: () => update((p) => ({ ...p, cart: [] })),
    setFilters: (filters) => update((p) => ({ ...p, filters })),
    signOut,
  }), [plan, user, ready, syncState, update, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlan(): PlanCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlan outside PlanProvider");
  return v;
}

// One catalog download per term per page load, shared by every component that asks.
const catalogPromises = new Map<string, Promise<Catalog>>();
function fetchCatalog(term: string): Promise<Catalog> {
  let p = catalogPromises.get(term);
  if (!p) {
    p = fetch(`/api/catalog?term=${term}`).then(async (r) => {
      if (!r.ok) throw new Error(`catalog ${r.status}`);
      const w = (await r.json()) as WireCatalog;
      return { term: w.term, sections: w.rows.map((row) => hydrateRow(row, term)), ratings: hydrateRatings(w.ratings), generatedAt: w.generatedAt };
    });
    p.catch(() => catalogPromises.delete(term));
    catalogPromises.set(term, p);
  }
  return p;
}

/** The cached catalog (client). */
export function useCatalog() {
  const { term } = usePlan();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCatalog(term).then((c) => alive && setCatalog(c)).catch((e) => alive && setError(String(e)));
    return () => { alive = false; };
  }, [term]);
  return { catalog, error };
}
