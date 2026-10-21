/**
 * theCourseForum public course pages (no login): https://thecourseforum.com/course/<SUBJ>/<NUM>/?latest=false
 * Each instructor row renders as: "<Name> <Last taught term> <times> <rating> Rating <difficulty> Difficulty <gpa> GPA".
 * Mirrors data/tcf_course.py from the planning session.
 */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export interface TcfInstructorRow {
  name: string;
  last_term: string | null;
  rating: number | null;
  difficulty: number | null;
  gpa: number | null;
  path: string;
}

export interface TcfCourse {
  course: string;
  description: string;
  instructors: TcfInstructorRow[];
  /** course-wide averages when shown */
  overall: { rating: number | null; difficulty: number | null; gpa: number | null };
}

function stripHtml(s: string): string {
  let t = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
  t = t.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  t = t.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  return t.trim();
}

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export function parseCoursePage(html: string, course: string): TcfCourse {
  const text = stripHtml(html);
  const instructors: TcfInstructorRow[] = [];
  const re = /href="(\/course\/(\d+)\/(\d+)\/)"([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  const termRe = "(Spring|Fall|Summer|J-Term|January)\\s+\\d{4}";
  while ((m = re.exec(html))) {
    const blk = stripHtml(m[4]).replace(/\s+/g, " ").trim();
    const mm = blk.match(new RegExp(`^(.+?) (${termRe}) (.*?)([\\d.—-]+) Rating ([\\d.—-]+) Difficulty ([\\d.—-]+) GPA`));
    if (mm) {
      instructors.push({ name: mm[1].split("> ").pop()!.trim(), last_term: mm[2], rating: num(mm[5]), difficulty: num(mm[6]), gpa: num(mm[7]), path: m[1] });
    }
  }
  let description = "";
  const i = text.indexOf("Course Description");
  if (i >= 0) description = text.slice(i + 18, i + 900).replace(/\s+/g, " ").split(" Instructors ")[0].trim();
  // overall numbers: the header shows "X.X Rating  X.X Difficulty  X.XX GPA" once before instructor rows
  const ov = text.match(/([\d.—-]+)\s+Rating\s+([\d.—-]+)\s+Difficulty\s+([\d.—-]+)\s+GPA/);
  return {
    course, description, instructors,
    overall: { rating: num(ov?.[1]), difficulty: num(ov?.[2]), gpa: num(ov?.[3]) },
  };
}

export async function fetchCourse(subject: string, catalog: string): Promise<TcfCourse | null> {
  const url = `https://thecourseforum.com/course/${subject}/${catalog}/?latest=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`tcf ${res.status} ${url}`);
  return parseCoursePage(await res.text(), `${subject} ${catalog}`);
}
