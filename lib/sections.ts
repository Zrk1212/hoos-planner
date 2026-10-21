/** Section helpers shared by search and requirements (kept apart to avoid an import cycle). */
import type { Section } from "./types";

/**
 * Which planned sections are one class for credits and requirements. Duplicate sections of a course collapse,
 * but a topics course with different topics (MDST 3510 "Business of Media" vs "Studying Screen Cultures") is
 * two classes. Discussions/labs carry 0 units; Engagement areas are never taken twice.
 */
export function creditKey(s: Section): string {
  if (isSub(s) || s.subject === "EGMT" || !s.topic) return s.course;
  return `${s.course}|${s.topic.toLowerCase()}`;
}

/** Sections that ride along with a lecture: discussions, labs, and zero-credit workshops/practica/drills. */
export const isSub = (s: Section) => s.component === "DIS" || s.component === "LAB" || (s.units_max === 0 && ["WKS", "PRA", "SPS", "CLN", "DRL"].includes(s.component ?? ""));
