/**
 * Plan storage behind the MCP save_plan/load_plan tools.
 *  - supabasePlanStore: direct service-role access (the deployed server and the maintainer's machine).
 *  - remotePlanStore: a friend's local server with no keys talks to https://hoosplanner.zrk.ventures/api/plans.
 * Pick with planStore(): HOOS_API set and no SUPABASE_SERVICE_ROLE_KEY → remote.
 */
import { randomBytes } from "node:crypto";
import type { PlanRow } from "./plan-schema";

/** term and cart may be left out on an update (they keep their saved value); a new plan defaults them. */
export type PlanWrite = Partial<Pick<PlanRow, "term" | "cart" | "profile" | "notes" | "meta">>;
const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** ifUpdatedAt: write only if the row still has this updated_at (else conflict), for read-merge-write updates. */
export interface SaveOpts { ifUpdatedAt?: string; retried?: boolean }
export interface SaveResult { code?: string; created?: boolean; conflict?: boolean; error?: string }

export interface PlanStore {
  load(code: string): Promise<{ row: PlanRow | null; error?: string }>;
  /**
   * Creates when code is undefined (returns a new code) or when the code has no row yet: the website hands
   * students a fresh code before Claude's first save, so the page is already watching it. Updates otherwise;
   * fields left undefined keep their saved value (so re-saving a cart never drops the profile).
   */
  save(code: string | undefined, row: PlanWrite, opts?: SaveOpts): Promise<SaveResult>;
  remove(code: string): Promise<{ error?: string }>;
}

export function supabasePlanStore(): PlanStore {
  return {
    async load(code) {
      const { adminClient } = await import("./supabase/admin");
      const { data, error } = await adminClient().from("shared_plans").select("code,term,profile,cart,notes,meta,updated_at").eq("code", code).maybeSingle();
      return { row: (data as PlanRow | null) ?? null, error: error?.message };
    },
    async save(code, row, opts = {}) {
      const { adminClient } = await import("./supabase/admin");
      const db = adminClient();
      const fields = defined(row);
      if (code) {
        if (!Object.keys(fields).length) {
          // nothing to change: an existing plan stays as it is (an empty update would read as "not found")
          const { data, error } = await db.from("shared_plans").select("code").eq("code", code).maybeSingle();
          if (error) return { error: error.message };
          if (data) return { code };
        } else {
          let q = db.from("shared_plans").update(fields).eq("code", code);
          if (opts.ifUpdatedAt) q = q.eq("updated_at", opts.ifUpdatedAt);
          const { data, error } = await q.select("code").maybeSingle();
          if (error) return { error: error.message };
          if (data) return { code };
          if (opts.ifUpdatedAt) return { conflict: true }; // changed (or deleted) since it was read
        }
      }
      const c = code ?? randomBytes(10).toString("hex");
      const { DEFAULT_TERM } = await import("./catalog");
      const { error } = await db.from("shared_plans").insert({ code: c, term: DEFAULT_TERM, cart: [], profile: null, notes: null, meta: {}, ...fields });
      // two first saves racing on one website code: the loser updates the row the winner just made (once)
      if (error?.code === "23505" && code && !opts.retried) return this.save(code, row, { retried: true });
      return error ? { error: error.message } : { code: c, created: true };
    },
    async remove(code) {
      const { adminClient } = await import("./supabase/admin");
      const { error } = await adminClient().from("shared_plans").delete().eq("code", code);
      return { error: error?.message };
    },
  };
}

export function remotePlanStore(base: string): PlanStore {
  const url = `${base.replace(/\/$/, "")}/api/plans`;
  return {
    async load(code) {
      try {
        const r = await fetch(`${url}?code=${encodeURIComponent(code)}`);
        if (r.status === 404) return { row: null };
        if (!r.ok) return { row: null, error: `plans API ${r.status}` };
        return { row: (await r.json()) as PlanRow };
      } catch (e) { return { row: null, error: (e as Error).message }; }
    },
    async save(code, row, opts = {}) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, ...row, if_updated_at: opts.ifUpdatedAt }) });
        if (r.status === 409) return { conflict: true };
        if (!r.ok) return { error: `plans API ${r.status}: ${(await r.text()).slice(0, 200)}` };
        return (await r.json()) as { code: string; created?: boolean };
      } catch (e) { return { error: (e as Error).message }; }
    },
    async remove(code) {
      try {
        const r = await fetch(`${url}?code=${encodeURIComponent(code)}`, { method: "DELETE" });
        return r.ok ? {} : { error: `plans API ${r.status}` };
      } catch (e) { return { error: (e as Error).message }; }
    },
  };
}

/** Public site that shows saved plans. Friends' local servers point at their HOOS_API; the deployment sets NEXT_PUBLIC_SITE_URL. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.HOOS_API || "https://hoosplanner.zrk.ventures").replace(/\/$/, "");
}

/** Live page for a plan code: the website re-reads it every few seconds, so each save_plan shows up there. */
export const planUrl = (code: string) => `${siteOrigin()}/schedule?plan=${code}`;

export function isFriendMode(): boolean {
  return !!process.env.HOOS_API && !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function planStore(): PlanStore {
  return isFriendMode() ? remotePlanStore(process.env.HOOS_API!) : supabasePlanStore();
}
