# UVA College of Arts & Sciences general education ("College Curriculum" / Engagements Pathway) — as applied to a student who entered the College in fall 2026

Researched 2026-10-19. Authoritative text is the **Undergraduate Record 2026-2027** (catoid=72), College of Arts & Sciences "Academic Rules, Regulations, and Information" page [R1]. The College's gen-ed site (gened.as.virginia.edu) and the College advising site (college.as.virginia.edu) add operational detail. Live section data (dates, units, grading basis, SIS course attributes) came from the SIS public class-search JSON endpoint [S1] on 2026-10-19 (term 1268 = Fall 2026, term 1272 = Spring 2027).

Governing-year rule: "Students are subject to the general education requirements in effect during the academic year when they first enter the University." [R1, Degree Information] — so the 2026-27 Record governs a fall-2026 entrant for all four years. "All entering first year students, with the exception of Echols Scholars, must complete the Engagements Pathway." [R1]

Nomenclature: the Record now says "Engagements Pathway" / "general education curriculum"; the gened site still uses "College Curriculum" and sometimes "new College Curriculum". Same thing.

---

## 1. ENGAGEMENTS (8 credits)

| Fact | Finding | Source |
|---|---|---|
| The four areas | EGMT 1510 Engaging Aesthetics ("Aesthetic Engagement" in the Record); EGMT 1520 Empirical & Scientific Engagement; EGMT 1530 Engaging Differences; EGMT 1540 Ethical Engagement | [R1], [G1], [E1] |
| Credits each | 2 credits each, 8 total. SIS: every EGMT section in Fall 2026 and Spring 2027 is `units: 2`, `grading_basis: Graded` (no CR/NC option). | [R1] "four 2 credit classes"; [S1] |
| Format | 7-week halves ("Quarters"). SIS section dates: Fall 2026 Q1 = 08/25/2026–10/14/2026, Q2 = 10/15/2026–12/08/2026. **Spring 2027 Q3 = 01/20/2027–03/16/2027, Q4 = 03/17/2027–05/04/2027.** Meetings are twice weekly 75-min (e.g., MoWe 8:00–9:15). | [S1]; [G1] "meet for 7 weeks" |
| First-year rule | Record: "Students must take four 2 credit classes in their first year, one each of the following engagement classes… may take these courses in any order." Gened: "Students in the Engagements Pathway must enroll in four EGMT classes in their first year." Engagements are "offered exclusively to first-year students". | [R1]; [G1]; [G2] |
| Expected pacing | Checklist: "Enroll in one EGMT course in each 'Quarter' (2 classes/4 credits per semester)." Gened: "two seven-week courses per semester"; FAQ: "Engagements are 7 week courses, so you can take two per semester." | [G3] (PDF), [G4], [G5] |
| Per-semester cap | Gened requirements page: **"Students may not enroll in more than 2 Engagement courses (4 credits) in a given semester."** Older copy of the same page: "should not enroll in more than 4 Engagement credits in a given semester." The Record itself states no per-semester cap. | [G1]; [G2]; [R1] |
| Two in the same 7-week block? | Not prohibited in the Record. Gened says students "are advised to enroll in only one of these courses at a given time" (advice, not a rule); the checklist's grid assumes one per Quarter. Whether SIS blocks two sections in the same Quarter: **UNVERIFIED** (no reserve caps or requirement designations appear on EGMT sections in SIS; time conflicts would be the practical constraint). | [G1], [G2], [G3], [S1] |
| Student who took only ONE in fall 2026 — can he take THREE in spring 2027? | **Policy conflict, needs the Advising Dean.** The first-year rule requires all four by end of spring 2027, but the gened cap says no more than 2 per semester. No published exception process for Engagements beyond the general petition route ("consult your Advising Dean… petition process… does not guarantee approval"). Mechanically, 3 in one semester would mean two in Q3 + one in Q4 (or 1+2); all four areas have both Q3 and Q4 sections in Spring 2027 (see counts below). Gened also states: "Students who fail to enroll in the required Engagement courses will be enrolled by the College." Action: email askthecollege@virginia.edu / the Advising Dean before the Nov 2–6 enrollment window and ask for (a) permission to enroll in 3 EGMT in spring, or (b) a plan for the 4th. **Outcome UNVERIFIED.** | [R1], [G1], [C7], [C8] |
| Registration mechanics | Students self-enroll in SIS. First-years build a shopping cart at Summer Orientation Day 1 and enroll in SIS during a randomly assigned window on Day 2. The College enrolls students who fail to enroll. Spring 2027: Advising Season began Oct 15, 2026; shopping cart opened Oct 16; undergraduate enrollment by SIS appointment Nov 2–6, 2026 (none Nov 3); open enrollment from Nov 23, 2026. In SIS the section title shows only the area name (e.g., "Engaging Aesthetics"); the specific topic is in the section's `topic` field / class details (SIS JSON shows e.g. topic "Defective History" for an EGMT 1540 section). Engagement swap form exists for Q1/Q2 swaps after deadlines. Pre-major advisor = the student's first-quarter Engagements instructor. | [C1], [C2], [C8], [G1], [S1], [H1], [R1 Academic Advising] |
| Quarter add/drop deadlines | Fall 2026 College calendar lists "Quarter 1 Engagement add/drop" Aug 31, 2026 and "Quarter 2" Oct 21, 2026. **Spring 2027 Q3/Q4 deadlines are not yet posted** on the College calendar (only Jan 20 start, Mar 6–14 recess, May 4 end, exams May 9–12). | [C2] |
| Is the Spring 2027 Engagements list published? | **Yes, in SIS** (searchable now; shopping cart opened Oct 16). SIS JSON on 2026-10-19 shows **229 EGMT sections for Spring 2027**: 1510 Q3 31 / Q4 30; 1520 Q3 28 / Q4 28; 1530 Q3 28 / Q4 28; 1540 Q3 28 / Q4 28 (all `enrl_stat: O`, capacity mostly 35, enrollment 0). Fall 2026 had 186 sections. The Engagements program site's course list (122 topic pages across the four areas) is not term-specific. Direct JSON link: [S1] with `term=1272&subject=EGMT`. The hercampus guide confirms both Q courses are picked at registration and cannot be changed later. | [S1], [E2], [H1] |

Section-count caveat: the page-3 fetch returned 29 rows after 200 on pages 1–2; the direct `catalog_nbr=1540` query returned 28+28, so the 229 total is consistent.

---

## 2. LITERACIES (variable credits)

Record: "Students must complete each of the following literacies: Rhetoric for the 21st Century, consisting of the First and Second Writing Requirements; World Languages; and Quantification, Computation, and Data Analysis." [R1]. "Following matriculation, all remaining Literacies and Disciplines requirements must be completed at the University of Virginia and must be taken on a graded basis." [R1]. Checklist: "It is recommended you complete these components before your fourth year." [G3]

### First Writing Requirement (3 credits; SIS attribute `ASUR-R21C1`)
- Five paths: ENWR 1505/1506 (two-semester stretch); ENWR 1507/1508 (multilingual stretch); **ENWR 1510, 1520, or 1530**; a First Writing Advanced course (ENWR 2510, 2000-level ENLT, ENCW 2300, ENCW 2600, etc.); or Echols. [R1]
- "Courses taken to fulfill the First Writing Requirement cannot also satisfy the Second Writing Requirement or any Disciplines requirement." ENWR courses cannot count toward a major/minor. [R1], [G6]
- Equivalent AP/transfer credit earned before matriculation can satisfy it; dual enrollment cannot. [R1]
- Writing Program: "Students must complete the first writing requirement during their first year." Placement by SAT EBRW 570–740 / ACT English 22–34 → ENWR 1510; lower → 1505/1506. Last names A–K take ENWR 1510 in fall, L–Z in spring. [W1]
- SIS: ENWR 1510 is 3 units, grading basis "ENWR Grading", 75 sections in Spring 2027. [S1]
- **Student in question already completed ENWR 1510 in fall 2026 → First Writing done.**

### Second Writing Requirement (3 credits; SIS attribute `ASUR-R21C2`)
- "All students, except Echols Scholars, must complete at UVA a second writing requirement course with a grade of C- or better." 3- or 4-credit writing-intensive course: ≥2 English writing assignments totaling ≥20 pages (excl. quizzes/finals), student/faculty ratio ≤30:1. Courses from other UVA schools, AP, advanced standing, dual enrollment, and transfer credit do not count. [R1]
- **Double counting allowed:** "A course that satisfies the second writing requirement may simultaneously count toward a student's major or minor program or toward a Disciplines requirement." Gened adds it may also count toward QCD. [R1], [G1]
- May be taken before/during First Writing (not advised). Does not substitute for First Writing. [R1]
- Find via SIS Course Attributes "Second Writing Requirement" (value `ASUR-R21C2`; e.g., HIST 1501, PHIL 2640, MUSI 2072, RELG 2210 in Spring 2027). If not coded, DocuSign "Second Writing Requirement Completion Form" with syllabus. [G6], [S1]
- **Deadline:** no hard deadline in the Record. Writing Program FAQ: the College "strongly encourages all undergraduates to fulfill the second writing requirement by the end of your sixth semester." Checklist offers "Plan to complete by Second/Third/Fourth Year." [W1], [G3]
- Poetry/fiction writing classes do not qualify. [G6]

### World Languages (SIS attribute `ASUW-WL`; variable credits)
- Three ways: (1) four semesters of the same language "(14 to 16 credits depending on the language) in the proper sequence typically finishing at the 2020 (advanced intermediate) level"; (2) after placement, complete the remaining courses up to the fourth semester (usually 2020); (3) exemption by placing beyond 2020 by exam. [R1]
- Placement by SAT II, AP, higher-level IB, or departmental test; "Students must follow the department's placement recommendations." Introductory language credit disallowed if it duplicates credit offered for admission. Equivalent AP/test credit can satisfy it; dual enrollment cannot. [R1]
- Specific exemption thresholds (College placement index): Chinese AP 5 / IB 7; Japanese SAT II >700 and/or AP 5; Latin AP 4 or 5 (also 3 credits for a 3000-level course); Modern Hebrew SAT II >560; Portuguese via PORT 2120/2050. Spanish online diagnostic due June 15; French/German/Italian online placement ~10 days before enrollment. Starting a brand-new language: enroll in 1010, no placement test needed. [C3], [C4]
- Deadline: a College page is reported to say the requirement "should be fulfilled before the seventh semester" (search snippet only; the page itself could not be reached) — **UNVERIFIED**. The Record states no deadline. [C5-snippet]
- Students with diagnosed language-learning disabilities may get the requirement modified via SDAC (substitute courses in English, must be graded, cannot count toward Disciplines). [R1]
- Example SIS: SPAN 2020 "Advanced Intermediate Spanish", 3 units, Student Option grading, `ASUW-WL`, 19 sections Spring 2027. [S1]

### Quantification, Computation, and Data Analysis — QCD (6+ credits; SIS attribute `ASUQ-QCD`)
- "two qualifying courses (6+ credits) in statistics, mathematics, data analysis, or logic" covering at least some of: theoretical math/stat; manipulating/interpreting mathematical expressions; computational/analytical methods; interpreting/communicating data. "This is not a Calculus requirement." Departments named: Anthropology, Mathematics, Philosophy, Psychology, Sociology, Statistics. Find via SIS Class Search attribute "Quantification" or Stellic. Equivalent AP/test credit earned before matriculation can satisfy it. [R1], [G7]
- **Course-by-course check (SIS `crse_attr_value`, both Fall 2026 and Spring 2027 sections):**

| Course | Units | Grading basis | QCD attribute? | Other attributes |
|---|---|---|---|---|
| STAT 2120 Intro Statistical Analysis | 4 | Student Option | **YES** `ASUQ-QCD` | — |
| STAT 1100 Chance | 3 | Student Option | YES | — |
| STAT 1601 Intro Data Science with R | 3 | Student Option | YES | CORE flags |
| STAT 2020 Statistics for Biologists | 4 | Student Option | YES | — |
| MATH 1210 Survey of Calculus I | 3 | Student Option | **YES** | — |
| MATH 1220 Survey of Calculus II | 3 | Student Option | YES | — |
| MATH 1310 Calculus I | 4 | Student Option | **YES** | — |
| MATH 1320 Calculus II | 4 | Student Option | YES | — |
| MATH 1160, 1192 | 3 | — | YES | — |
| MATH 2310 Calculus III | 4 | Student Option | no (it is `ASUD-CMP`, a Discipline) | — |
| PSYC 2005 Research Methods & Data Analysis I | 3 | Graded | YES | — |
| **DS 1001 Foundation of Data Science** | 3 | Student Option | **NO** (no attribute at all) | School of Data Science (acad_group DSCI) — non-College course |
| **DS 1002 Programming for Data Science** | 3 | Student Option | **NO** | DSCI, non-College |
| **CS 1110 Intro to Programming** | 3 | Graded | **NO** (only cost flag) | ENGR; College-equivalent for the 108 but "may not count toward general education requirements" per Record |
| CS 1111 | — | — | no sections in Fall 2026 or Spring 2027 (CS 1112/1113 exist; also no QCD attribute) | ENGR |
| **ECON 2010 Principles: Micro** | 3 | Student Option | **NO** | `ASUD-SES` (Social & Economic Systems Discipline) |
| COMM 1800 Foundations of Commerce | 3 | Graded | NO | none; McIntire (non-College) |

- The Record explicitly lists CS courses among those "considered College-equivalent" but that "may not count toward general education requirements." [R1, Course Rules]
- MUSI 1310 "Basic Musical Skills" carries `CORE-QUANTITAT` (a different, University "CORE" tag), not `ASUQ-QCD` — do not confuse the two. [S1]

---

## 3. DISCIPLINES (21 credits; SIS attribute family `ASUD-*`)

- Record: "Students must complete the Disciplines Requirement through one course (3 or 4 credits each) from at least six different departments in each of the following seven categories." → **all seven categories, one course each, 3+ credits each (21 credits), drawn from at least six different departments** (i.e., at most one department may supply two Discipline courses — the checklist's "Only one department can have a check in Column 2"). [R1], [G3]
- The seven (with SIS codes): Artistic, Interpretive & Philosophical Inquiry (`ASUD-AIP`); The Chemical, Mathematical & Physical Universe (`ASUD-CMP`); Cultures & Societies of the World (`ASUD-CSW`); Historical Perspectives (`ASUD-HP`); Living Systems (`ASUD-LS`); Science & Society (`ASUD-SS`); Social & Economic Systems (`ASUD-SES`). [R1], [S1]
- **One course for two Disciplines?** No for BA students: "When a course counts toward two different Disciplines, students may choose which category the course fulfills" — i.e., it counts for ONE. Gened: "courses may only count towards fulfilling one category for each student." BS students only: may double-count one 3-credit course across two of {CSW, HP, SES} if listed in both, and may take 9 credits in one or two of {CMP, LS, SS} instead of 3 each; BS students need only five departments. [R1], [G1]
- **Discipline + Literacy at once?** Yes for Second Writing: a Second Writing course "may simultaneously count toward… a Disciplines requirement" (and gened says also toward QCD). A First Writing course cannot count for any Discipline. World-language substitute courses (SDAC modification) cannot count toward Disciplines. Record otherwise silent on a single course counting as both a Discipline and QCD; SIS shows courses carrying both tags are rare — treat generic QCD+Discipline double-counting as **UNVERIFIED** (ask the College Registrar). [R1]
- Major courses may count toward Disciplines; CR/NC courses may not; AP/transfer "equivalent" credit earned before matriculation may; X000T generic credit may not. [G1], [R1]
- **Where the list lives:** SIS Class Search → Course Attributes field (search "Disciplines" / the category name), or Stellic. Record: "Qualifying courses may be found through the Class Search function in the Student Information System (SIS) and Stellic." Public SIS search link on gened site [G8]; the JSON endpoint [S1] exposes `crse_attr_value`. There is no static College-maintained course list. [R1], [G8]
- **Typical courses → Disciplines (SIS attributes, Fall 2026 / Spring 2027):**

| Course | Disciplines (student picks one) | Notes |
|---|---|---|
| ECON 2010 (and 2020) | **SES** | 3 u; also McIntire's required SES prereq |
| COMM 1800 | none | non-College; no gen-ed attribute |
| PHIL 1000 Intro to Philosophy | AIP | Fall 2026 only |
| PHIL 1330 Virtual Worlds | AIP or SS | Spring 2027 |
| PHIL 1410 Forms of Reasoning | AIP | — |
| PHIL 1730 Intro Moral & Political Phil | AIP | — |
| PHIL 1740 Issues of Life and Death | AIP or SS | — |
| PHIL 2060 Phil Problems in Law | AIP or SES | — |
| PHIL 2120 History of Phil: Modern | AIP or HP | — |
| ARTH 2000 Art Worlds; ARTH 1861 Silk Road | AIP or CSW | ARTH 1500 not offered |
| ARTH 2052 Ancient Egypt; 2054 Roman Art; 2745 African American Art | AIP or HP | — |
| ARTS 2000 Intro Studio Art; ARTS 2610 Drawing I; other ARTS 2xxx studio | AIP | all Graded (no CR/NC option) |
| DS 1001 | **none in SIS** (but the SDS's own BSDS gen-ed counts it as Science & Society for SDS students — see §5) | — |
| CS 1110 | none | — |
| MATH 1210 / 1310 | none (QCD only) | MATH 2310 = CMP |
| STAT 2120 | none (QCD only) | — |
| PSYC 1010 Intro Psychology | LS or SES | Fall 2026 only (1 section); none Spring 2027 |
| PSYC 2150 Intro Cognition; 2200 Neural Basis of Behavior | LS | Spring 2027 |
| PSYC 2600 Intro Social Psych | SES or SS | Spring 2027 |
| PSYC 2700 Intro Child Psych | LS or SES | Spring 2027 |
| SOC 1010 Intro Sociology | SES | 13 sections Spring 2027 |
| ANTH 1010 Intro to Anthropology | LS or SES | 7 sections Spring 2027 |
| HIUS 2001 American History to 1865 | HP | Spring 2027 |
| HIUS 2051 War & the Making of America | HP or SES | — |
| HIEU 2041 Roman Republic & Empire | HP or SES | — |
| HIEU 2102 Modern Jewish History | CSW or HP | — |
| HIST 1501 Intro Seminar in History | HP + Second Writing (`ASUR-R21C2`) | — |
| RELG 1010 Intro Western Religious Traditions | CSW or HP | Fall 2026 |
| RELG 1000 Questions in the Study of Religion | AIP or CSW | Spring 2027 |
| RELG 1040 Intro Asian Religions | CSW or HP | Spring 2027 |
| RELG 2210 Religion, Ethics & Global Environment | AIP or SS + Second Writing | Spring 2027 |
| MUSI 1310 Basic Musical Skills; MUSI 1410 Symphonic Listening | AIP | — |
| MUSI 2072 Meet the Beatles | AIP or HP + Second Writing | Spring 2027 |
| DRAM 1010 How Theatre Works; DRAM 1020 Speaking in Public; DRAM 2020 Acting I | AIP | all Graded |

---

## 4. CREDIT RULES

| Rule | Finding | Source |
|---|---|---|
| Total | 120 credits; ≥96 passed on a graded basis; GPA ≥2.000; 60 of 120 at UVA; two-year residency; expected 8 full-time semesters (9 with dean permission); 54 credits to enter 5th semester, 84 to enter 7th. | [R1 Degree Information] |
| Minimum College credits | "Among the 120 credits, at least 108 must be College or College-equivalent credits for those admitted as first-year students" (102 for transfer admits). | [R1]; [C6] |
| Max non-College credits | Therefore **12 credits** from outside the College (Architecture, Batten, Commerce, Data Science, Education, Engineering, Nursing). INST capped at 3 credits. SCPS courses not allowed at all. | [R1], [C6] |
| What counts as "College" | Courses taught inside the College of Arts & Sciences (subject codes list at as.virginia.edu/course-subject-codes-college-classes) plus College-equivalent transfer/test credit. By faculty approval, College-equivalent and usable for gen-ed: ARH, ARCH 1010, MSE 2010, PHS. College-equivalent but NOT for gen-ed: ARCH 1020, **all CS courses**, STS 3500, USEM 1580/2580. Explicitly non-College: ELA, INST, **KINE, KLPA**, PLSK, ROTC (AIRS/MISC/NASC), SEMS, UNST, USEM 1570/2570. | [R1 Course Rules], [C6] |
| COMM credit limit for College students | **No COMM-specific cap exists.** COMM courses are simply non-College credits inside the 12-credit allowance (COMM 1800 = 3 of the 12). McIntire's own rules apply once a student enrolls there. | [R1], [C6], [M2] |
| Other caps | KLPA/KINE physical education 2 credits; DANC 8; INST 3; Language House 2; MUBD/MUEN/MUPF 16 (8 at 3000+); PLSK 2; ROTC 12; USEM 8 (one per semester). | [R1], [C6] |
| CR/NC | Up to **two courses per semester** CR/NC "exclusive of physical education courses"; max **24 credits** CR/NC toward the degree (18 for 2nd-year transfers, 12 for 3rd-year). "Courses taken for CR/NC may not be used for any major, minor, competency or area requirements"; gened: CR/NC courses cannot count toward general education; Record: remaining Literacies and Disciplines "must be taken on a graded basis." **Deadline to elect CR/NC = the add deadline** ("no later than the add deadline… requests for exceptions… seldom granted"). Fall 2026 add/CR-NC deadline was Sept 8, 2026; Spring 2027 deadline not yet published (typically ~2 weeks after Jan 20 start) — **UNVERIFIED date**. EGMT, ENWR 1510, CS 1110, COMM 1800, DRAM/ARTS studio courses are "Graded" only in SIS (no CR/NC option); most ECON/SOC/PSYC/STAT/MATH sections are "Student Option". | [R1 Grades], [C6], [C2], [S1] |
| Audit | AU carries no credit. | [C6] |
| Pre-matriculation credit | Max 60 credits via transfer/AP/IB/dual enrollment; no CLEP. X000T credit never satisfies gen-ed. | [C6], [G9] |

---

## 5. IF HE LEAVES THE COLLEGE (McIntire / SDS) — brief

- **General principle:** gen-ed is owed to the school that grants the degree. The College's Engagements/Literacies/Disciplines are College degree requirements; once a student matriculates into another school, that school's Record section governs.
- **McIntire (B.S. in Commerce, "3-Year Format" = enter as a second-year):** Internal-transfer prerequisites: COMM 1800; First Writing Requirement; the SES Discipline "using ECON 2010"; minimum 24 graded UVA credits. After admission: "Students must complete all general education requirements in their assigned general education pathway (according to the College of Arts and Sciences)." "Most students will follow the Engagements Pathway, completing Engagements in their first year"; those not required to take Engagements (Echols, transfers) follow Disciplines Plus. So **Engagements, Literacies and Disciplines all carry over**; COMM 2005 satisfies Second Writing and COMM 2004 satisfies 3 of the 6 QCD credits; Commerce students cannot use the College's BS modification; CR/NC cannot satisfy any gen-ed; no course may double-count toward two gen-ed requirements. McIntire admissions also wants World Language "through the 2020 level" and STAT 2120, calculus, ECON 2010/2020 before entry. The College's 108-College-credit rule becomes moot (McIntire instead requires 75 graded credits after matriculation incl. 42 COMM). | [M1], [M2], [M3], [G5] |
- **School of Data Science (BSDS):** admits first-years only (apply spring of first year; 24 UVA credits by end of first-year spring; DS 1001 at UVA with C- or better, not CR/NC; a programming course). The SDS "will accept students from any of the College of Arts & Sciences general education curricular programs (Echols, Engagements Pathway, Disciplines Plus, Forums)" and runs its own 33-credit gen-ed: First Writing (3), Second Writing (DS 4022), QCD 6 (DS 2026 covers 3), and the same seven Disciplines at 3 credits each — **no Engagements and no World Language listed** in the BSDS gen-ed; DS 1001 counts as Science & Society there. Echols are waived entirely. So Engagements completed in the first year are not required by SDS (but they still count as credits); the College's 108-credit, World Language, and 7-week Engagement rules become moot. | [D1], [D2] |
- Returning to the College later: a student who completes a semester in another school must re-apply as an Intra-University transfer and then follows Disciplines Plus "unless they have already completed the Engagements requirement." | [R1 Curricular Requirements, Intra-University Transfers] |

---

## 6. KINE / KLPA physical-activity classes

- The activity program is now **KLPA** ("Physical Education (KLPA, formerly KINE)"); SIS example: **KLPA 1150 Basketball — 1 unit, grading basis Credit/No Credit, School of Education (EDUC/EDKI)**, offered Fall 2026 and Spring 2027. KINE 1105 Pickleball has no sections in either term (CourseForum shows it as not currently taught). ~40 one-credit activity classes per semester. | [S1], [K1], [K2] |
- Count toward the 120? Yes, but only **2 credits** of KLPA/KINE may be applied toward the B.A., and they are **non-College** credits (part of the 12 non-College allowance, not the 108). | [R1 Maximum Credit Hour Limits], [C6] |
- Grading: Credit/No Credit only (SIS grading basis; the Education School's program page says activity classes "can ONLY be taken on a Credit/No Credit basis"). PE courses are excluded from the two-CR/NC-courses-per-semester count. | [S1], [K2], [R1 Grades] |
- They satisfy no gen-ed requirement.

---

## 7. PRACTICAL PLANNING

| Item | Finding | Source |
|---|---|---|
| Typical load | "Students must enroll in an average of 15 credits for each of their allotted eight semesters" (adjusted for AP credit, summer, J-Term). First-years are told to shopping-cart 15–20 College classes before orientation, mostly 1000/2000-level, and consider a 2-credit USEM. | [C7], [C1] |
| Minimum | 12 credits per semester ("Special permission is required to register for fewer than 12"); earning <12 triggers Academic Warning (unless SDAC-approved); first-semester students may not be part-time. Good standing also needs semester GPA ≥1.800 and ≤1 grade of C- or below. | [R1 Course Load, Academic Standing], [C7] |
| Maximum | 18 credits without permission ("Students enrolled in more than 18 credits without the permission of the dean will be removed from the last class(es) added"); dean may approve up to 21; "Permission will not be granted to enroll in more than 21 credits." A 17-credit cap for new students' first semester is reported on the Credit Hour Overload form (PDF now 404) — **UNVERIFIED** and moot for spring. | [R1], [C7], [C9] |
| How 1- and 2-credit courses interact with full-time status | All enrolled credits count toward the 12/18 numbers, including 2-credit EGMT, 2-credit USEM, 1-credit KLPA and 1-credit PSYC 1020-type courses. Two EGMT in a semester = 4 credits. Caveat: a Q4 (second-half) EGMT is on the schedule from the start of term, so it counts at census; but if a student drops a Q3 course after it ends and has no Q4 replacement, the semester's *earned* credits could fall below 12 → Academic Warning. Also note the ≥96 graded-credits rule: CR/NC KLPA credits don't count toward it. | [R1]; inference from [S1] dates |
| Spring 2027 calendar | Classes Jan 20 – May 4, 2027; recess Mar 6–14; exams May 9–12; Q3 = Jan 20–Mar 16, Q4 = Mar 17–May 4 (SIS). January Term Jan 4–15, 2027. Add/drop/CR-NC/withdraw deadlines for spring not yet posted (fall equivalents: add+CR/NC Sept 8, drop Sept 9, withdraw Oct 20). | [C2], [S1] |
| Enrollment windows | Spring 2027 SIS appointments Nov 2–6, 2026; open enrollment Nov 23, 2026. | [C2] |

### Worked example — Spring 2027 for a student who took EGMT 1510 + ENWR 1510 in fall 2026
Remaining Engagements: 1520, 1530, 1540 (6 credits). Policy-compliant maximum is 2 EGMT (4 cr) in spring → one area still unmet at end of first year, which violates the first-year rule; taking all 3 (two in Q3 + one in Q4, or 1+2) violates the 2-per-semester cap. Either path needs the Advising Dean's sign-off; get it before Nov 2. A full-time compliant 15–16-credit spring: 2–3 EGMT (4–6) + a QCD course (STAT 2120 = 4 or MATH 1210 = 3) + ECON 2010 (3, SES, McIntire prereq) + a World Language course (3–4) + optionally a 1-credit KLPA (CR/NC, non-College). Keep total ≤18 and remember EGMT/ENWR/CS/COMM sections have no CR/NC option and gen-ed must be graded anyway.

---

## Sources

Record (official; read via the Browser pane because records.ureg.virginia.edu blocks scripted fetches):
- [R1] Undergraduate Record 2026-2027 — College of Arts & Sciences: Academic Rules, Regulations, and Information — https://records.ureg.virginia.edu/content.php?catoid=72&navoid=6598 (print view: …&print=)
- [R0] Record 2026-2027 Schools index — https://records.ureg.virginia.edu/content.php?catoid=72&navoid=6680 ; College landing — https://records.ureg.virginia.edu/content.php?catoid=72&navoid=6698
- [M1] Record 2026-2027 — McIntire School of Commerce: Academic Rules 3-Year Format — https://records.ureg.virginia.edu/content.php?catoid=72&navoid=6683 (2-Year Format: navoid=6684)
- [D1] Record 2026-2027 — Program: Data Science, B.S. — https://records.ureg.virginia.edu/preview_program.php?catoid=72&poid=11828

College gen-ed site (gened.as.virginia.edu):
- [G1] Requirements — https://gened.as.virginia.edu/requirements
- [G2] College Curriculum Requirements (older duplicate page) — https://gened.as.virginia.edu/college-curriculum-requirements
- [G3] Engagements Pathway Checklist (PDF) — https://gened.as.virginia.edu/sites/default/files/2025-04/Engagements-Pathway-Checklist.pdf (fillable: …/Engagements-Pathway-Checklist_form.pdf)
- [G4] The Engagements — https://gened.as.virginia.edu/engagements
- [G5] FAQ — https://gened.as.virginia.edu/frequently-asked-questions-0
- [G6] The Literacies — https://gened.as.virginia.edu/literacies ; Second Writing — https://gened.as.virginia.edu/second-writing-requirement
- [G7] QCD — https://gened.as.virginia.edu/quantification-computation-and-data-analysis
- [G8] The Disciplines (SIS search link) — https://gened.as.virginia.edu/disciplines
- [G9] External credit — https://gened.as.virginia.edu/external-credit-general-education ; Transfer students 2025-26+ — https://gened.as.virginia.edu/node/1876 ; About — https://gened.as.virginia.edu/about ; Other pathways — https://gened.as.virginia.edu/other-curriculum-pathways

Engagements program site:
- [E1] https://engagements.as.virginia.edu/ (area pages /egmt-1510-engaging-aesthetics etc.)
- [E2] Course list (topics, not term-specific) — https://engagements.as.virginia.edu/engagements-course-list

College advising site (college.as.virginia.edu):
- [C1] New first-year students: Summer Advising & Enrollment guide (Fall 2026, updated 2026-07-21) — https://college.as.virginia.edu/new-students
- [C2] 2026-2027 Academic Calendar — https://college.as.virginia.edu/calendar/2026-2027-academic-calendar
- [C3] World Language placement & contact index — https://college.as.virginia.edu/world-language-requirement-placement-and-contact-information
- [C4] World Language FAQs — https://college.as.virginia.edu/world-language-requirement-faqs
- [C5] (search snippet only; page resolved to a staff profile) "Overview of Requirements and Restrictions" — https://college.as.virginia.edu/node/37 — UNVERIFIED
- [C6] Credits (120/108, caps, CR/NC; updated 2026-07-28) — https://college.as.virginia.edu/credits
- [C7] Course load — https://college.as.virginia.edu/course_load ; Full-time/part-time — https://college.as.virginia.edu/full-time-and-part-time-enrollment-status and https://college.as.virginia.edu/enrollment-requirements-full-time-and-part-time-status
- [C8] Engagement Swap form & instructions — https://college.as.virginia.edu/engagement-swap-form-and-instructions ; Appeals — https://college.as.virginia.edu/policies/appeals_grievances
- [C9] Credit Hour Overload form (404 on 2026-10-19) — https://college.as.virginia.edu/sites/college.as.virginia.edu/files/2024-05/Credit%20Hour%20Overload%20Preview%20Form.pdf

Writing Program:
- [W1] First/Second Writing FAQ — https://writingrhetoric.as.virginia.edu/faq ; placement — https://writingrhetoric.as.virginia.edu/fwr-placement

SIS (live data, 2026-10-19; needs a browser User-Agent):
- [S1] https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch?institution=UVA01&term=1272&subject=EGMT&page=1 (change `term`/`subject`/`catalog_nbr`); public Class Search UI — https://sisuva.admin.virginia.edu/psp/ihprd/EMPLOYEE/PSFT_HR_CSPRD/c/COMMUNITY_ACCESS.CLASS_SEARCH.GBL

McIntire:
- [M2] First-year applicants (57 non-Commerce credits incl. Engagements Pathway) — https://www.commerce.virginia.edu/bs-commerce/admissions/first-years
- [M3] High-school eligibility/prereqs — https://www.commerce.virginia.edu/bs-commerce/admissions/eligibility-high-school ; transfer eligibility — https://commerce.virginia.edu/bs-commerce/admissions/eligibility-transfer

SDS:
- [D2] BSDS admissions/FAQ — https://datascience.virginia.edu/degrees/bsds/admissions ; https://datascience.virginia.edu/degrees/bsds/faq

KINE/KLPA:
- [K1] CourseForum KINE 1105 Pickleball — https://thecourseforum.com/course/KINE/1105/
- [K2] Kinesiology dept (KLPA program) — https://education.virginia.edu/offices-departments/kinesiology ; older Curry LPA page — https://curry.virginia.edu/admissions/student-services/lifetime-physical-activity-program (search snippet; page not fetched)

Other:
- [H1] HerCampus "Navigating the Engagements Curriculum at UVA" (student guide, ~2024) — https://www.hercampus.com/school/uva/the-engagements-curriculum-at-uva-how-to-navigate-them/
- Registrar 2026-27 calendar (fetch denied; search snippet: spring add/drop "vary by school") — https://registrar.virginia.edu/calendar/academic/2026-2027

Could not be reached: registrar.virginia.edu (403/denied), hooslist.virginia.edu (403), the College overload-form PDF (404), college.as.virginia.edu/node/37 (resolved to a staff page).
