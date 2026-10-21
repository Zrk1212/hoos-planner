import type { Rating, Section } from "./types";

export interface TermInfo {
  code: string; name: string; start_date: string | null; end_date: string | null;
  q_a_start: string | null; q_a_end: string | null; q_b_start: string | null; q_b_end: string | null;
  synced_at: string | null; section_count: number | null;
}

export interface RatingMap {
  [course: string]: { overall: Rating | null; instructors: Record<string, Rating> };
}

export interface Catalog {
  term: TermInfo;
  sections: Section[];
  ratings: RatingMap;
  generatedAt: string;
}
