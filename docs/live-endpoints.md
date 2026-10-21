# Live SIS / Stellic access (Phase 2, local only)

Discovered 2026-10-20 against the author's signed-in Chrome. Everything runs through `browser-harness` (CDP attach to the
user's own Chrome); the user signs in to NetBadge + Duo themselves. No credentials or tokens are stored.

## SIS (Highpoint CX on PeopleSoft)
Base `https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/` (JSON, needs the SIS session cookies) and
`.../psp/ihprd/UVSS/SA/s/` (page shell with `#main_iframe`; our helpers select `#main_iframe`, then the first
iframe, then the top window).

Reads (GET, JSON):
- `WEBLIB_HCX_EN.H_SHOPPING_CART.FieldFormula.IScript_ShoppingCartData?institution=UVA01&term=1272&acad_career=UGRD`
  → `{term_descr, classes:[{subject, catalog_nbr, class_section, class_nbr, descr, component, unt_taken, related,
  enrl_tot, enrl_cap, enrl_stat, wait_tot, wait_cap, meetings:[{days,start_time,end_time,start_dt,end_dt,facility_descr,instructor}],
  relate_class_nbr_1, reserve_caps}], enrollment_terms}`. `start_time`/`end_time` are empty for TBA meetings.
- Unofficial transcript: `WEBLIB_HCX_RE.H_VW_UNOFF_TRANSCR.FieldFormula.IScript_{EnrollmentTerms,Enrollment?strm=,TestCredit,TransferCredit,Programs,TestScores}`
  with `institution=UVA01&transcript_type=UNADV&acad_career=UGRD`.
  - `EnrollmentTerms` → `{enrollment_terms:[{strm, descr:"2026 Fall"}]}`; `Enrollment` → `{enrollments:[{subject, catalog_nbr,
    class_nbr, descr, crse_topic?, units_attempted, units_earned, grade}]}` (units may be numbers or strings like "3.00";
    grade is "" until posted).
  - `TestCredit` → `{test_credit:{programs:[{terms:[{strm, descr, tests:[{course:"MATH 1310", course_title, attempted, earned, grade:"TE"}]}]}]}}`.
    Placement rows end in `P` (`SPAN 3010P`, 0 credits); generic credit ends in `T` (`HIST 1000T`).
  - Profile rules (`buildTranscriptProfile` in lib/live/sis.ts): a placement row sets World Language only for a language
    subject (SPAN, FREN, GERM, ITAL, PORT, CHIN, JAPN, KOR, RUSS, ARAB, HEBR, LATI, GREE, HIND, URDU, PERS, TURK, SWAH, ASL)
    at a level above 2020; graded rows use `units_earned`, ungraded rows show `units_attempted`; a past term with no
    grades stays `in_progress` with a "grades not yet posted" note; one row per course+topic (a retake keeps the passing
    attempt, then the later term); test-credit rows keep SIS's grade string (`TE`).
- Planner: no XHR; the page embeds `highpoint.planned_terms` (`[{strm, descr, courses:[{subject, catalog_nbr, descr, units, crse_id}]}]`).
- Enrollment Dates: page text only (`H_ENROLLMENT_DATES`).

Writes: `IScript_ValidateCart` (POST `class=…&term=…`), `DeleteFromCart`, `AddToCart` all require a per-session
request token header that the page attaches. We do not extract it; writes are driven through the page's own
buttons (select rows → Validate / Delete; class-details page → Add to Cart). Validate was verified; the
result dialog reads "Validation results … OK to Add / Potential Problem".

### Cart page DOM (what the UI driver relies on)
- Each cart row is a `tr` / `[role=row]` / `li` / `.row` containing one `<button id="14401">` (text empty) for the
  class number and exactly one checkbox. Rows are selected by that button's id or trimmed text, then **read back**:
  the set of checked rows must equal the request exactly (no extras, none missing) or the action aborts.
- The term dropdown is an `<input>` whose value is like `2027 Spring`; options render as leaf elements whose
  textContent is the term. A switch is only trusted when the input value equals the wanted term **and** the page
  re-rendered (a fresh "Finished Loading" after we blanked the old one, or a different row set), polled ≤ 20 s.
- "Finished Loading" is present once the frame has loaded; Validate shows a "Validation results" dialog.
- Dialogs are `[role=dialog]` (fallback `dialog[open]`, `.modal.show`); we always act on the last one and only on
  buttons inside it. Nothing whose text matches /enroll/i is ever clicked.

### Fail-closed behaviour of the write tools
- `live_delete_from_cart`: readCart before → select rows (exact read-back) → Delete → confirm inside the dialog
  (exactly one Yes/Delete/Confirm/OK button, else abort) → readCart after. The reply lists exactly which class
  numbers disappeared, which are still there, and warns if anything not requested disappeared.
- `live_add_to_cart`: readCart before (already-present numbers are skipped) → class-details page → wait ≤ 20 s for
  "Add to Cart" → click → wait ≤ 10 s for the options dialog. If the dialog has any text/number input (permission
  number), radio/select/combobox (related section), spinbutton (units) or more than one checkbox, **nothing is clicked**
  and the dialog text is returned. Otherwise the single waitlist checkbox is set per `waitlist_ok` (default **false**)
  and the single confirm button inside the dialog is clicked; readCart after must contain the class number.
- Any abort message ends with "nothing was changed/confirmed" so the model can relay it verbatim.

### Confirm tokens (two-call gate, lib/live/confirm.ts)
Both write tools require `confirm: true` **and** a `
## Stellic
`https://login.stellic.virginia.edu/app/` (virginia.stellic.com redirects). SSO via NetBadge in the browser.
- Audit: `/app/audit` → "Full Audit" with blocks "NN Remaining / NN / <Requirement>", rows as
  `Taken|In Progress|Remaining` / `CODE` / title / `N CREDITS` / `CURRENTLY TAKING IN FALL REGULAR ACADEMIC SESSION '26` or
  `TRANSFERRED FALL '26` / `TE`. Underlying XHR: `/planner/getauditinfo/` (responses prefixed with `)]}',`).
- Courses: `/app/audit/transcript` → Transfer Credits, per-term enrolled rows, Test Scores (`AP - Biology / TAKEN … / 5`).

## Confirmation gate (cart writes)
`live_add_to_cart` / `live_delete_from_cart` are two-step. Step 1 (`confirm:false`) always refuses. Step 2
(`confirm:true`) makes the server show a native macOS dialog (`osascript display dialog`) on the student's own
screen listing the exact class numbers; the write proceeds only if the student clicks the approve button
(Cancel is the default, 120 s timeout). The model never holds a secret that could stand in for the student,
so prompt injection through page text cannot approve a change. Non-macOS hosts refuse writes.
