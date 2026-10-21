"use client";
/**
 * The plan code that ties this browser to a Claude chat. The website issues it before Claude's first save:
 * the student pastes it into Claude with their first message, save_plan creates the plan under it, and the
 * open pages (already polling that code) fill in.
 * Two codes: the active one (what the pages show; a ?plan= link replaces it) and this browser's own one (what
 * the first message hands to Claude). They differ after opening someone else's link, which keeps a friend's
 * shared plan from being overwritten by your own chat.
 */
import { useEffect, useState } from "react";

const KEY = "hp:active-plan";
const OWN_KEY = "hp:own-plan";
const EVENT = "hp:plan-code";
export const PLAN_CODE = /^[a-f0-9]{20}$/;

// when localStorage is off, keep the codes for this page load
let memory: string | null = null;
let ownMemory: string | null = null;

function newCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function storageWorks(): boolean {
  try { localStorage.setItem("hp:probe", "1"); localStorage.removeItem("hp:probe"); return true; } catch { return false; }
}

/**
 * Remembers the active code: per tab (sessionStorage, so a friend's link opened in another tab doesn't switch
 * this one) and as the default for new tabs (localStorage). False when storage is off: then the code lives in
 * the address bar so a reload keeps it.
 */
function store(code: string): boolean {
  memory = code;
  let ok = true;
  try { sessionStorage.setItem(KEY, code); localStorage.setItem(KEY, code); } catch { ok = false; }
  if (!ok) keepInUrl(code);
  window.dispatchEvent(new CustomEvent(EVENT));
  return ok;
}

function keepInUrl(code: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("plan") === code) return;
  url.searchParams.set("plan", code);
  window.history.replaceState(window.history.state, "", url);
}

/** This browser's own code, issued on first use. */
export function ownPlanCode(): string {
  let own: string | null = ownMemory;
  try { own = localStorage.getItem(OWN_KEY) ?? ownMemory; } catch {
    // storage off: after a reload the only surviving code is the one in the address bar
    own = ownMemory ?? new URLSearchParams(window.location.search).get("plan");
  }
  if (own && PLAN_CODE.test(own)) return own;
  const c = newCode();
  ownMemory = c;
  try { localStorage.setItem(OWN_KEY, c); } catch { /* storage off */ }
  return c;
}

/** ?plan= from the URL, else the remembered code, else this browser's own code. */
export function activePlanCode(): string {
  const q = new URLSearchParams(window.location.search).get("plan");
  let saved: string | null = memory;
  try { saved = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY) ?? memory; } catch { /* storage off */ }
  if (q && PLAN_CODE.test(q)) {
    // adopt the link's code once, then drop it from the address bar so a later switch (copying the first
    // message, New plan) isn't undone by the stale ?plan= on the next read
    // (unless storage is off: then the address bar is the only place the code survives a reload)
    const kept = q === saved ? storageWorks() : store(q);
    if (kept) {
      const url = new URL(window.location.href);
      url.searchParams.delete("plan");
      window.history.replaceState(window.history.state, "", url);
    }
    return q;
  }
  if (saved && PLAN_CODE.test(saved)) return saved;
  const c = ownPlanCode();
  store(c);
  return c;
}

/** Show this browser's own plan on the pages (after copying the first message). */
export function showOwnPlan() {
  const c = ownPlanCode();
  if (c !== activePlanCode()) store(c);
}

/** True when the pages show a code this browser didn't issue (a friend's link). */
export function isForeignCode(code: string): boolean {
  return code !== ownPlanCode();
}

/** Start over: a new empty plan for this browser. The old one stays reachable by its link. */
export function resetPlanCode(): string {
  const c = newCode();
  ownMemory = c;
  try { localStorage.setItem(OWN_KEY, c); } catch { /* storage off */ }
  store(c);
  return c;
}

/** The active code (or with own=true, this browser's own code), null until mounted; follows other tabs. */
export function usePlanCode({ own = false }: { own?: boolean } = {}): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      const c = own ? ownPlanCode() : activePlanCode();
      if (!own && !storageWorks()) keepInUrl(c); // client navigation dropped ?plan=; put it back
      setCode(c);
    };
    sync();
    // other tabs only matter when they issue a new code for this browser (New plan, Delete plan)
    const onStorage = (e: StorageEvent) => { if (e.key === OWN_KEY) sync(); };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", onStorage); };
  }, [own]);
  return code;
}
