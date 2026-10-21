/** Shared validation for saved plans: used by the MCP tools and by /api/plans. */
import { z } from "zod";
import type { Profile } from "./types";

// NUL and lone surrogates can't be stored in Postgres jsonb/text; pasted audits sometimes carry them
export const cleanText = (s: string) => s.replace(/\u0000/g, "").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
const Short = z.string().max(200).transform(cleanText);
/** "comm1800", "econ  2010" → "COMM 1800", the form the requirement checks match on. */
export const normCourse = (c: string) => c.toUpperCase().replace(/\s+/g, " ").trim().replace(/^([A-Z]{2,4})\s*(\d{4}[A-Z]?)$/, "$1 $2");
export const ProfileSchema = z.object({
  courses: z.array(z.object({
    course: Short.transform(normCourse), credits: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(0).max(30).default(3)), grade: z.string().max(8).optional(),
    status: z.enum(["completed", "in_progress", "transfer", "test", "planned"]), term: Short.optional(),
    title: Short.optional(), generic: z.boolean().optional(), source: z.string().max(40).optional(),
    attrs: z.array(z.string().max(40)).max(20).optional(),
  })).max(200).default([]),
  tests: z.array(z.object({ exam: Short, score: z.coerce.string().max(8), awarded: z.array(Short).max(10).optional() })).max(50).default([]),
  worldLanguagePlacement: z.boolean().default(false),
  program: Short.optional(),
  pathway: z.enum(["engagements", "disciplines-plus", "echols", "unknown"]).optional(),
  notes: z.array(Short).max(50).default([]),
  parsedAt: z.string().max(40).optional(),
  sourceFormat: z.enum(["stellic", "sis-transcript", "freeform", "unknown"]).optional(),
}).describe("Profile JSON exactly as returned by parse_audit");

export const CartSchema = z.array(z.number().int().min(10000).max(99999)).max(40).describe("Class numbers currently in the cart").default([]);
/** Plan codes: 80 random bits, the only secret for reading and updating. Pasted codes get trimmed and lowercased. */
export const PlanCode = z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.string().regex(/^[a-f0-9]{20}$/, "A plan code is 20 letters a-f and digits"))
  .describe("Plan code from the Hoos Planner website (in the student's first message) or from an earlier save_plan");

export const GOALS = ["college", "mcintire", "sds"] as const;
export type Goal = (typeof GOALS)[number];
export const GoalsSchema = z.array(z.enum(GOALS)).max(3).transform((g) => [...new Set(g)])
  .describe("Programs the student is aiming for; the website's Requirements page shows these. college = A&S gen-ed, mcintire = Commerce school prerequisites, sds = School of Data Science prerequisites");
export const BackupsSchema = z.array(z.object({
  class_nbr: z.number().int().min(10000).max(99999),
  replaces: z.number().int().min(10000).max(99999).optional().describe("Class number of the main-schedule section this backs up"),
})).max(20).describe("Backup sections: shown in the cart with a Backup badge, kept off the week and out of conflict checks");

export interface PlanCartItem { class_nbr: number; backup?: boolean; replaces?: number }
export interface PlanMeta { goals?: Goal[] }

export function toProfile(p: z.infer<typeof ProfileSchema>): Profile {
  return { ...p, pathway: p.pathway ?? "unknown", parsedAt: p.parsedAt ?? new Date().toISOString(), sourceFormat: p.sourceFormat ?? "unknown" };
}

export interface PlanRow { code: string; term: string; profile: Profile | null; cart: PlanCartItem[]; notes: string | null; meta?: PlanMeta | null; updated_at: string }

/**
 * Main sections first, then backups (deduped; a number in both lists stays a main section).
 * A backup's replaces is kept only when it names a main section.
 */
export function buildCart(main: number[], backups: Array<{ class_nbr: number; replaces?: number }> = []): PlanCartItem[] {
  const m = [...new Set(main)];
  const mainSet = new Set(m);
  const seen = new Set(m);
  const b = backups.filter((x) => !seen.has(x.class_nbr) && (seen.add(x.class_nbr), true));
  return [...m.map((class_nbr) => ({ class_nbr })), ...b.map((x) => ({ class_nbr: x.class_nbr, backup: true, ...(x.replaces && mainSet.has(x.replaces) ? { replaces: x.replaces } : {}) }))];
}
