/**
 * Live tools (local stdio server only, enabled with LIVE_BROWSER=1): read the student's own Stellic and SIS
 * through their signed-in Chrome via browser-harness, and act on the SIS cart only behind a two-call confirm
 * gate (confirm:true + a native macOS dialog the student must approve, see lib/live/confirm.ts).
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { profileSummary } from "../audit-parser";
import { DEFAULT_TERM, loadCatalog } from "../catalog";
import { findConflicts } from "../meetings";
import { buildAcadGroupIndex, buildAttrIndex, evaluate } from "../requirements";
import type { Section } from "../types";
import { askHuman, type WriteAction } from "../live/confirm";
import { LiveError } from "../live/runner";
import { cartMeetings, readCart, readEnrollmentDates, readPlannerText, readTranscriptProfile } from "../live/sis";
import { addViaUi, deleteViaUi, validateViaUi } from "../live/sis-write";
import { readAuditPage, readCoursesPage, summarizeAuditBlocks } from "../live/stellic";
import { clipProfile, statusText } from "./register";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (e: unknown) => text(e instanceof LiveError ? `⚠ ${e.message}` : `⚠ ${(e as Error).message}`);
const uniq = (nbrs: number[]) => [...new Set(nbrs)];
const nbrList = (ns: number[]) => ns.map((n) => `#${n}`).join(", ");

export const LIVE_INSTRUCTIONS = `
Live tools are enabled (this server runs on the student's own computer and reads their signed-in Chrome):
- live_read_profile → the authoritative profile from the SIS unofficial transcript (prefer it over pasted text). Keep the PROFILE_JSON for requirement_status.
- live_read_stellic → what Stellic itself says is satisfied / remaining, plus its course list.
- live_read_cart → the SIS shopping cart for the term (with rooms) and the Planner; live_validate_cart → SIS's own "OK to Add / Potential Problem" verdicts.
- live_add_to_cart / live_delete_from_cart (only when the server was started with LIVE_WRITES=1) change the student's real SIS cart. Two-step: the first call (confirm:false) refuses; show the student exactly what will change and wait for a yes in the chat; then call again with confirm:true — the server pops a native dialog on the student's screen and proceeds only if THEY click approve, so expect a short wait. Never enroll; the student presses Enroll in SIS during their appointment. Live calls run one at a time; each opens and closes its own Chrome window.
If a live tool reports "not signed in", tell the student to sign in to NetBadge in Chrome and retry.`;

/** The two-call gate: returns the refusal text, or null when the call may proceed. */
/**
 * Two-step gate. Step 1 (confirm:false): refuse and tell the model to ask the student. Step 2 (confirm:true):
 * the server itself shows a native macOS dialog on the student's screen; the write proceeds only if they click
 * approve. The model never holds a secret that could stand in for the student.
 */
export async function gateWrite(action: WriteAction, nbrs: number[], confirm: boolean, what: string): Promise<string | null> {
  if (!confirm) return `Not done. This changes the student's real SIS cart. Tell the student exactly what will change (${what}), ask for a yes in the chat, then call again with the same class numbers and confirm:true — a confirmation dialog will then appear on their screen and nothing happens until they click approve there.`;
  const v = await askHuman(action, nbrs, what);
  if (!v.approved) return `Not done: ${v.reason}`;
  return null;
}

export function registerLiveTools(server: McpServer, term = DEFAULT_TERM, opts: { writes?: boolean } = {}) {
  const termDescr = async () => { const c = await loadCatalog(term); return c.term.name.replace(/^(\w+) (\d{4})$/, "$2 $1"); }; // "Spring 2027" -> "2027 Spring"

  server.registerTool("live_read_profile", {
    title: "Read my SIS transcript (live)",
    description: "Build the student's profile from their SIS unofficial transcript (enrollments per term, grades, AP/test credit, placement, program) through their signed-in Chrome. Returns a summary and PROFILE_JSON.",
    inputSchema: z.object({}),
  }, async () => {
    try {
      const profile = clipProfile((await readTranscriptProfile()).profile);
      const cat = await loadCatalog(term);
      const st = evaluate({ profile, attrIndex: buildAttrIndex(cat.sections), acadGroups: buildAcadGroupIndex(cat.sections) });
      return text(`${profileSummary(profile)}\n\nRequirement status (our engine):\n${statusText(st)}\n\nPROFILE_JSON:\n${JSON.stringify(profile)}`);
    } catch (e) { return fail(e); }
  });

  server.registerTool("live_read_stellic", {
    title: "Read my Stellic audit (live)",
    description: "Read the student's Stellic audit (Track Progress) and Courses pages through their signed-in Chrome. Returns Stellic's own per-requirement verdicts, the course rows, and a parsed PROFILE_JSON.",
    inputSchema: z.object({ page: z.enum(["audit", "courses", "both"]).default("both") }),
  }, async ({ page }) => {
    try {
      const parts: string[] = [];
      let profile = null;
      if (page !== "courses") {
        const a = await readAuditPage();
        parts.push(`Stellic audit verdicts:\n${summarizeAuditBlocks(a.text) || "(could not summarize; raw text follows)"}\n\nAudit text:\n${a.text.slice(0, 6000)}`);
        profile = a.profile;
      }
      if (page !== "audit") {
        const c = await readCoursesPage();
        parts.push(`Stellic courses page:\n${c.text.slice(0, 5000)}`);
        profile = c.profile;
      }
      if (profile) { const p = clipProfile(profile); parts.push(`Parsed:\n${profileSummary(p)}\n\nPROFILE_JSON:\n${JSON.stringify(p)}`); }
      return text(parts.join("\n\n"));
    } catch (e) { return fail(e); }
  });

  server.registerTool("live_read_cart", {
    title: "Read my SIS cart (live)",
    description: "Read the student's SIS shopping cart for the term (class numbers, times, rooms, seats, status) plus the Planner and enrollment appointment, through their signed-in Chrome. Also checks the cart for time conflicts with our engine.",
    inputSchema: z.object({ include_planner: z.boolean().default(true), include_dates: z.boolean().default(true) }),
  }, async ({ include_planner, include_dates }) => {
    try {
      const { cart } = await readCart(term);
      const cat = await loadCatalog(term);
      const byNbr = new Map(cat.sections.map((s) => [s.class_nbr, s]));
      const clock = (t?: string | null) => (t ? t.slice(0, 5).replace(".", ":") : "");
      const rows = cart.classes.map((c) => {
        const meetings = c.meetings ?? [];
        const meet = meetings.map((m) => {
          const when = m.start_time && m.end_time ? `${m.days ?? ""} ${clock(m.start_time)}-${clock(m.end_time)}`.trim() : `${m.days ?? ""} TBA`.trim();
          return `${when}${m.facility_descr ? ` @ ${m.facility_descr}` : ""}`;
        }).join(" | ") || "TBA";
        const span = meetings[0] ? (Date.parse(meetings[0].end_dt) - Date.parse(meetings[0].start_dt)) / 86400000 : NaN;
        const half = Number.isFinite(span) && span < 70 ? ` [${meetings[0].start_dt}→${meetings[0].end_dt}]` : "";
        return `#${c.class_nbr} ${c.subject} ${c.catalog_nbr}-${c.class_section} ${c.component} ${c.descr} — ${meetings.map((m) => m.instructor).filter(Boolean).join(", ") || "TBA"}; ${meet}${half}; ${c.unt_taken || 0} cr; ${c.enrl_stat} ${c.enrl_cap - c.enrl_tot}/${c.enrl_cap} open${c.wait_tot ? `, ${c.wait_tot} waiting` : ""}${c.related ? " (related/lab)" : ""}`;
      });
      // conflict check using the cart's own meeting data (falls back to catalog rows)
      const secs: Section[] = cart.classes.map((c) => {
        const base = byNbr.get(c.class_nbr);
        const meetings = cartMeetings(c);
        return { ...(base ?? { term, class_nbr: c.class_nbr, subject: c.subject, catalog_nbr: c.catalog_nbr, course: `${c.subject} ${c.catalog_nbr}`, class_section: c.class_section, descr: c.descr, topic: null, component: c.component, section_type: null, units: String(c.unt_taken), units_min: null, units_max: null, grading_basis: null, acad_group: null, acad_org: null, session_descr: null, start_dt: null, end_dt: null, enrl_stat: c.enrl_stat_code, class_capacity: c.enrl_cap, enrollment_total: c.enrl_tot, enrollment_available: c.enrl_cap - c.enrl_tot, wait_cap: c.wait_cap, wait_tot: c.wait_tot, rqmnt_designtn: null, attrs: [], instructors: [], instructor_names: null, reserve_caps: [], instruction_mode_descr: null, meetings: [] } as Section), meetings: meetings.length ? meetings : (base?.meetings ?? []) };
      });
      const conflicts = findConflicts(secs);
      const parts = [`SIS cart for ${cart.term_descr} (${cart.classes.length} rows):\n${rows.join("\n") || "empty"}`, conflicts.length ? `Time conflicts:\n${conflicts.map((c) => `- ${c.reason}`).join("\n")}` : "No time conflicts among cart rows."];
      if (include_planner) { try { parts.push(`Planner:\n${(await readPlannerText()).replace(/\n+/g, " | ").slice(0, 2500)}`); } catch (e) { parts.push(`Planner: ${(e as Error).message}`); } }
      if (include_dates) { try { parts.push(`Enrollment dates:\n${(await readEnrollmentDates()).slice(0, 1500)}`); } catch (e) { parts.push(`Enrollment dates: ${(e as Error).message}`); } }
      return text(parts.join("\n\n"));
    } catch (e) { return fail(e); }
  });

  server.registerTool("live_validate_cart", {
    title: "Validate my SIS cart (live)",
    description: "Run SIS's own Validate on cart rows (defaults to all) and return its verdicts (OK to Add / Potential Problem: conflicts, unit max, prerequisites, consent). Read-only; does not enroll.",
    inputSchema: z.object({ class_nbrs: z.array(z.number().int()).max(40).optional() }),
  }, async ({ class_nbrs }) => {
    try {
      const nbrs = class_nbrs?.length ? uniq(class_nbrs) : (await readCart(term)).cart.classes.filter((c) => !c.related).map((c) => c.class_nbr);
      if (!nbrs.length) return text("The SIS cart is empty for this term; nothing to validate.");
      return text(await validateViaUi(await termDescr(), nbrs));
    } catch (e) { return fail(e); }
  });

  if (!opts.writes) return;

  const ClassNbrs = z.array(z.number().int().min(10000).max(99999)).min(1).max(10);
  const Confirm = z.boolean().default(false).describe("Must be true on the second call, after the student said yes in the chat");

  server.registerTool("live_add_to_cart", {
    title: "Add classes to my SIS cart (live)",
    description: "Add class numbers to the student's real SIS shopping cart via the SIS class-details page (same as 'Add by class number'). Two-step gate: call with confirm:false first (nothing changes), ask the student to confirm exactly these class numbers in the chat, then call again with confirm:true — a native dialog on the student's screen must be approved by them before anything is clicked. Fails closed: if SIS asks for a permission number, a related section choice or units, nothing is clicked and the dialog text is returned. waitlist_ok=true ticks SIS's 'add to waitlist if full' box; the default false leaves it unticked. Each add is verified by re-reading the cart. Never enrolls.",
    inputSchema: z.object({ class_nbrs: ClassNbrs, waitlist_ok: z.boolean().default(false).describe("Tick SIS's 'waitlist if class is full' option in the Add dialog (default false)"), confirm: Confirm }),
  }, async ({ class_nbrs, waitlist_ok, confirm }) => {
    const nbrs = uniq(class_nbrs);
    const refusal = await gateWrite("add", nbrs, confirm, `adding ${nbrList(nbrs)} to their SIS cart${waitlist_ok ? " (joining the waitlist if a class is full)" : ""}`);
    if (refusal) return text(refusal);
    let td: string;
    try { td = await termDescr(); } catch (e) { return fail(e); }
    const out: string[] = [];
    for (const n of nbrs) { try { out.push(await addViaUi(term, td, n, waitlist_ok)); } catch (e) { out.push(`#${n}: ⚠ ${(e as Error).message}`); } }
    return text(out.join("\n"));
  });

  server.registerTool("live_delete_from_cart", {
    title: "Delete classes from my SIS cart (live)",
    description: "Remove class numbers from the student's real SIS shopping cart via the SIS cart page. Two-step gate: call with confirm:false first (nothing changes), ask the student to confirm exactly these class numbers in the chat, then call again with confirm:true — a native dialog on the student's screen must be approved by them before anything is clicked. Fails closed: rows are selected and read back from the page (must match exactly), the confirmation click is scoped to SIS's dialog, and the result is verified by re-reading the cart; the reply lists exactly what was removed. Does not drop enrolled classes.",
    inputSchema: z.object({ class_nbrs: ClassNbrs, confirm: Confirm }),
  }, async ({ class_nbrs, confirm }) => {
    const nbrs = uniq(class_nbrs);
    const refusal = await gateWrite("delete", nbrs, confirm, `removing ${nbrList(nbrs)} from their SIS cart`);
    if (refusal) return text(refusal);
    try { return text(await deleteViaUi(term, await termDescr(), nbrs)); } catch (e) { return fail(e); }
  });
}
