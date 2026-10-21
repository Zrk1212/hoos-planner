# ChatGPT app directory submission packet

Everything the OpenAI app submission form asks for, ready to paste. Zac submits; nothing here is sent anywhere by itself.

## Listing

| Field | Value |
| --- | --- |
| App name | Hoos Planner |
| Subtitle (≤30) | Plan your UVA class schedule (28) |
| Category | Education |
| Developer | Zac Klein (individual; verified OpenAI organization required) |
| Website | https://hoosplanner.zrk.ventures |
| Support | https://github.com/Zrk1212/hoos-planner/issues |
| Privacy policy | https://hoosplanner.zrk.ventures/privacy |
| Terms of use | https://hoosplanner.zrk.ventures/terms |
| MCP server URL | https://hoosplanner.zrk.ventures/api/mcp |
| Authentication | No Auth |
| Countries | United States |
| Language | English |

**Description**

> Hoos Planner builds a University of Virginia class schedule with you. Tell it what you want (no 8 a.m. classes, Fridays off, an easy Second Writing class, the prerequisites for McIntire or the School of Data Science) and it searches the current term's sections, ranks them by theCourseForum difficulty and ratings, checks for time conflicts, and tracks your College of Arts & Sciences requirements. Paste your Stellic audit or SIS transcript and it counts what you've already finished. Your plan appears live on hoosplanner.zrk.ventures as a weekly schedule, an SIS-style cart and a requirements checklist, with the class numbers to paste into SIS. Hoos Planner never signs in to SIS and never enrolls you; you enroll yourself. Student-built, not affiliated with UVA.

**Assets** (regenerate with `npx tsx scripts/directory-assets.ts` while `npm run dev -- --port 3077` is up)

| File | Size | Use |
| --- | --- | --- |
| `public/directory/logo-1024.png` | 1024×1024 | App logo |
| `public/directory/logo-512.png` | 512×512 | App logo (small) |
| `public/directory/screenshot-schedule.png` | 706×800 | Weekly schedule |
| `public/directory/screenshot-cart.png` | 706×800 | SIS-style cart |
| `public/directory/screenshot-requirements.png` | 706×800 | Requirements checklist |

The screenshots show demo plan `fdf21c75837779d89dd6` with the dev-only pieces removed (Next's badge, the shared-plan line, the localhost link row, New/Delete buttons).

## Tool annotations

All nine tools work only on Hoos Planner's own data: a nightly snapshot of UVA's public class search plus theCourseForum ratings, and plans saved in Hoos Planner's own database. None reaches SIS, Stellic, email or any outside account, so every tool is `openWorldHint: false`.

| Tool | readOnly | destructive | openWorld | Justification |
| --- | --- | --- | --- | --- |
| `get_term_info` | true | false | false | Returns which term the cached catalog covers and its snapshot date; reads a static file, changes nothing. |
| `get_planning_rules` | true | false | false | Returns the bundled College, McIntire and SDS rules text; no inputs, no writes. |
| `parse_audit` | true | false | false | Parses text the student pasted into a profile in memory and returns it; nothing is stored. |
| `search_sections` | true | false | false | Filters and ranks the cached term catalog; no writes and no outside calls. |
| `check_conflicts` | true | false | false | Computes time overlaps and credits for the given class numbers from the cached catalog; no writes. |
| `requirement_status` | true | false | false | Evaluates requirements from the given profile and cart in memory; nothing is stored. |
| `rate_course` | true | false | false | Looks up cached theCourseForum ratings for one course; no writes. |
| `save_plan` | false | false | false | Creates or updates the student's plan in Hoos Planner's own database; it never deletes a plan, fields left out keep their values, and saving the same arguments twice gives the same plan (`idempotentHint: true`). |
| `load_plan` | true | false | false | Reads one saved plan by its code and returns it; no writes. |

Deleting a plan is deliberately not a tool: the student clicks **Delete plan** on the website.

## Test cases

Run each in a fresh ChatGPT chat with Hoos Planner enabled. Class numbers are Spring 2027 (term 1272); if the catalog has rolled to a new term, swap in numbers from a `search_sections` result.

### Positive

1. **Term info**
   - Prompt: "Which semester does Hoos Planner have classes for, and when does the second 7-week half start?"
   - Expected tool: `get_term_info`
   - Expected result: names Spring 2027, the catalog snapshot date and both 7-week half date ranges.

2. **Audit + requirements**
   - Prompt: "Here's my Stellic audit, what do I still need for the College?" followed by a pasted Stellic audit.
   - Expected tools: `parse_audit`, then `get_planning_rules` and `requirement_status`
   - Expected result: a short summary of finished, in-progress and missing Engagements, Literacies and Disciplines, with no raw JSON shown.

3. **Search**
   - Prompt: "Find me an easy Second Writing class that starts at 10 a.m. or later."
   - Expected tool: `search_sections` with `attrs: ["SWR"]` and an earliest start of 10:00
   - Expected result: a few sections ranked easiest first, each with its 5-digit class number, days, times and seats.

4. **Course rating**
   - Prompt: "How hard is MUSI 2072, and which professor is best?"
   - Expected tool: `rate_course` with `course: "MUSI 2072"`
   - Expected result: theCourseForum rating, difficulty and GPA overall and per instructor, plus which sections each instructor teaches this term.

5. **Build and save a schedule**
   - Prompt: "Build me a 15-credit spring schedule with DS 1002 and Fridays off, and put it on the website."
   - Expected tools: `search_sections`, `check_conflicts`, `save_plan`
   - Expected result: about 15 credits Monday to Thursday with no conflicts, the class-number paste line, and a hoosplanner.zrk.ventures/schedule?plan=… link that shows the schedule.

6. **Load a plan**
   - Prompt: "Open my plan fdf21c75837779d89dd6. What's left for the School of Data Science?"
   - Expected tools: `load_plan`, then `requirement_status`
   - Expected result: the plan's classes and the SDS prerequisites it satisfies, is taking and still needs.

### Negative (tool triggered: None)

1. Prompt: "Enroll me in DS 1002 in SIS right now." Expected: no tool; explains that Hoos Planner can't enroll and gives the class number to paste into SIS "Add by class number".
2. Prompt: "Which first-year dorm at UVA is the best?" Expected: no tool; says Hoos Planner only covers classes and points to UVA Housing.
3. Prompt: "Help me plan my Virginia Tech schedule for next semester." Expected: no tool; says Hoos Planner only has UVA's catalog.

## Release notes (v1.0)

> First release in the ChatGPT app directory. Search UVA's current-term sections ranked by theCourseForum difficulty, check time conflicts, track College of Arts & Sciences, McIntire and School of Data Science requirements from a pasted Stellic audit, and see your plan live on hoosplanner.zrk.ventures.

## Domain verification

`app/.well-known/openai-apps/route.ts` serves `OPENAI_APPS_CHALLENGE` as plain text (`Cache-Control: no-store`), and returns 404 while it is unset.

1. In the OpenAI submission form, copy the domain-verification token for `hoosplanner.zrk.ventures`.
2. Add it to Vercel production (paste the token when prompted):
   ```bash
   vercel env add OPENAI_APPS_CHALLENGE production
   ```
3. Redeploy production so the variable is picked up.
4. Check it (should print the token exactly, nothing else):
   ```bash
   curl -s https://hoosplanner.zrk.ventures/.well-known/openai-apps
   ```
5. Click **Verify** in the form. Keep the variable set until the listing is approved; OpenAI may re-check.

If the form asks for a different path than `/.well-known/openai-apps`, move the route folder to match before step 3.

## Demo video checklist

- [ ] 1–3 minutes, screen recording of chatgpt.com on a laptop, ChatGPT in light mode, no personal tabs or bookmarks visible.
- [ ] Start from a new chat; show adding Hoos Planner from **+** (or the app already connected).
- [ ] Run test case 5 end to end: the prompt, the tool calls, the reply with class numbers.
- [ ] Click the plan link and show Schedule, Cart and Requirements filling in.
- [ ] Ask a follow-up change ("swap the Tuesday class for something later") and show the site update.
- [ ] Show one refusal: "Enroll me in DS 1002" and the reply that you enroll yourself in SIS.
- [ ] Use a demo plan or a fresh one; never a real student's audit, grades or plan code.
- [ ] Upload unlisted (YouTube or Loom) and paste the link into the form.

## Zac's to-do

1. Verify the OpenAI organization (platform.openai.com → Settings → Organization → Verifications). Submission is blocked until it passes.
2. Set `OPENAI_APPS_CHALLENGE` in Vercel and redeploy (Domain verification above).
3. Record and upload the demo video.
4. Fill the submission form from this file and submit.
5. After approval, set `NEXT_PUBLIC_CHATGPT_APP_URL` in Vercel to the listing URL and redeploy; the ChatGPT tab in setup then leads with **Add Hoos Planner from the ChatGPT app directory** and folds the Developer-mode steps under "Not listed yet?".

## Sign in with ChatGPT interest form

Form: https://openai.com/form/sign-in-with-chatgpt-interest/. The exact fields may differ; these answers cover the usual questions.

- **Name / role:** Zac Klein, developer of Hoos Planner (student at the University of Virginia).
- **Company / product:** Hoos Planner, https://hoosplanner.zrk.ventures
- **What does your product do?** Hoos Planner helps University of Virginia undergraduates build a class schedule. An AI advisor searches the current term's sections, ranks them by difficulty and ratings, checks time conflicts and tracks degree requirements, and the plan appears live on the site as a weekly schedule, a cart and a requirements checklist. Today students reach it through an MCP connector in ChatGPT, Claude or Codex.
- **How would you use Sign in with ChatGPT?** We want a chat built into the website so students don't have to install a connector. A student clicks Sign in with ChatGPT, and the chat on hoosplanner.zrk.ventures runs on their own ChatGPT plan usage, calling the same nine Hoos Planner tools. We would not store their ChatGPT credentials or conversation history; the plan itself is saved under a random code as it is today.
- **Why plan usage instead of your own API key?** Hoos Planner is free and student-run. Paying per token for every student's planning chat doesn't scale for us, and most of our students already pay for ChatGPT. Using their plan keeps the site free and lets them pick up the same conversation in ChatGPT.
- **Expected users:** UVA undergraduates during course-enrollment windows (November and April); low hundreds of students at launch, with peaks during enrollment weeks.
- **Data you'd request:** sign-in identity only (to tie a chat to the student) and model access for the chat. No email marketing and no access to other ChatGPT data.
- **Timeline:** ready to integrate as soon as access is granted; the web chat is already being built behind a flag.
