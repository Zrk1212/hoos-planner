// Shared types for catalog rows, plans and profiles.

export type DayCode = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";

export interface Meeting {
  days: DayCode[];
  /** minutes after midnight; null when TBA */
  start: number | null;
  end: number | null;
  /** ISO dates (YYYY-MM-DD) for this meeting pattern */
  start_dt: string | null;
  end_dt: string | null;
  facility: string | null;
  instructor: string | null;
}

export interface Instructor {
  name: string;
  email?: string;
}

export interface ReserveCap {
  rsrv_cap_nbr?: number;
  start_dt?: string;
  enrl_cap?: number;
  descr?: string;
  enrl_tot?: number;
}

/** A row of public.sections (subset used by the app). */
export interface Section {
  term: string;
  class_nbr: number;
  subject: string;
  catalog_nbr: string;
  course: string; // "DS 1002"
  class_section: string | null;
  descr: string | null;
  topic: string | null;
  component: string | null;
  section_type: string | null;
  units: string | null;
  units_min: number | null;
  units_max: number | null;
  grading_basis: string | null;
  acad_group: string | null;
  acad_org: string | null;
  session_descr: string | null;
  start_dt: string | null;
  end_dt: string | null;
  enrl_stat: string | null;
  class_capacity: number | null;
  enrollment_total: number | null;
  enrollment_available: number | null;
  wait_cap: number | null;
  wait_tot: number | null;
  rqmnt_designtn: string | null;
  attrs: string[];
  instructors: Instructor[];
  instructor_names: string | null;
  meetings: Meeting[];
  reserve_caps: ReserveCap[];
  instruction_mode_descr: string | null;
}

export interface Rating {
  course: string;
  instructor: string; // '' = course-level
  rating: number | null;
  difficulty: number | null;
  gpa: number | null;
  last_term: string | null;
  tcf_path: string | null;
}

export type CourseStatus = "completed" | "in_progress" | "transfer" | "test" | "planned";

export interface ProfileCourse {
  course: string; // "ECON 2010"
  title?: string;
  credits: number;
  grade?: string; // A, B+, CR, TE, T, IP ...
  status: CourseStatus;
  term?: string; // "Fall 2026"
  /** where the parser saw it */
  source?: string;
  /** true when the row is generic test credit like HIST 1000T */
  generic?: boolean;
  /** SIS attributes of the specific section this row came from (cart rows); wins over the merged course index */
  attrs?: string[];
}

export interface TestScore {
  exam: string; // "AP Calculus AB"
  score: string; // "5"
  awarded?: string[]; // courses awarded
}

export interface Profile {
  courses: ProfileCourse[];
  tests: TestScore[];
  /** World Language satisfied by placement/exemption */
  worldLanguagePlacement: boolean;
  program?: string;
  pathway?: "engagements" | "disciplines-plus" | "echols" | "unknown";
  notes: string[];
  parsedAt: string;
  sourceFormat: "stellic" | "sis-transcript" | "freeform" | "unknown";
}

export interface CartItem {
  class_nbr: number;
  /** optional user note e.g. "backup" */
  note?: string;
}

export interface Plan {
  id?: string;
  term: string;
  name: string;
  profile: Profile | null;
  cart: CartItem[];
  filters?: Record<string, unknown>;
}

export const DISCIPLINES = {
  AIP: "Artistic, Interpretive & Philosophical Inquiry",
  CMP: "Chemical, Mathematical & Physical Universe",
  CSW: "Cultures & Societies of the World",
  HP: "Historical Perspectives",
  LS: "Living Systems",
  SS: "Science & Society",
  SES: "Social & Economic Systems",
} as const;
export type DisciplineCode = keyof typeof DISCIPLINES;
export const DISCIPLINE_CODES = Object.keys(DISCIPLINES) as DisciplineCode[];

export const ENGAGEMENTS = {
  "1510": "Engaging Aesthetics",
  "1520": "Empirical & Scientific Engagement",
  "1530": "Engaging Differences",
  "1540": "Ethical Engagement",
} as const;
export type EngagementNbr = keyof typeof ENGAGEMENTS;

/** SIS crse_attr_value codes we care about. */
export const ATTR = {
  FWR: "ASUR-R21C1",
  SWR: "ASUR-R21C2",
  WL: "ASUW-WL",
  QCD: "ASUQ-QCD",
  discipline: (c: DisciplineCode) => `ASUD-${c}`,
} as const;
