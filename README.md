# Hoos Planner

A schedule advisor for College of Arts & Sciences undergraduates on the Engagements Pathway who may apply to McIntire or the School of Data Science. You describe the schedule you want to Claude; Claude plans it with this project's MCP tools and the website shows it live.

**Phase 1 scope**

- Catalog: every Spring 2027 section from the public SIS class search (no login), refreshed nightly, plus theCourseForum rating / difficulty / GPA per instructor.
- Website (Claude-first): `save_plan` returns a link to `/schedule?plan=<code>`. The Schedule (week grid), Cart (every section with SIS details, backups badged) and Requirements (Stellic-style checklist for the plan's goals: College, McIntire, SDS) pages re-read the plan every 3 s, so each save in the chat shows up on its own. The code is remembered in the browser, so the nav links keep the same plan. `/about` is the maker's page.
- Shelved for now: the in-browser Audit and Builder pages and the Advisor setup page live in `app/_shelved/` (not routed; `/audit`, `/builder`, `/advisor` redirect). Move a folder back to `app/` to restore it.
- Advisor: an **MCP server** (`/api/mcp`, Streamable HTTP, stateless) so the student's own Claude subscription (claude.ai custom connector, Claude Desktop, Claude Code) does the advising. Tools: `search_sections`, `check_conflicts`, `parse_audit`, `requirement_status`, `rate_course`, `get_planning_rules` (serves `lib/mcp/knowledge.md`, condensed from `docs/`), `get_term_info`, `save_plan` / `load_plan` (short plan codes in `shared_plans`). A stdio variant lives in `scripts/mcp-stdio.ts`. No Anthropic API key anywhere.
- Auth: Supabase magic link; plans persist per user in `user_plans` (RLS). Without signing in everything lives in `localStorage`.

## Policy (read this before adding features)

- **No credentials.** The app never asks for NetBadge, Duo, or any UVA password, and never automates a login. Personal data enters only by the student pasting text they copied from their own session.
- **No writes to SIS.** Enrolling stays manual: the cart produces class numbers for SIS "Add by class number".
- **Low SIS volume.** The catalog is one server-side pull per night (`/api/sync` via Vercel Cron, or `npm run sync:sis`), about 95 requests. Nothing in the browser ever calls SIS. theCourseForum is scraped at ≤2 requests/second with a 7-day on-disk cache.
- **Policy pages.** `/privacy`, `/terms`, and `/security` (plus `/.well-known/security.txt`) describe what is stored and how to report issues. Keep them accurate when data handling changes. Contact is GitHub issues (no working mailbox yet); plans are self-deleted with the Delete plan button (`DELETE /api/plans?code=`).
- **RLS on every table.** `public.assert_rls_enabled()` raises if any public table lacks row level security; the migration calls it, and `npm run check:rls` runs it against the linked database (needs the service-role key in `.env.local`). Every new table needs `enable row level security` and explicit policies. Catalog tables are public read, service-role write; `sync_log` and `shared_plans` are service-role only.
- A Chrome extension that reads the student's own logged-in Stellic/SIS tab is Phase 2 and out of scope here.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
supabase link --project-ref <ref>
supabase db push             # applies supabase/migrations
npm run seed                 # loads data/seed/*.json so the app works before the first live sync
npm run sync:sis             # full live pull of the term (optional now, nightly in prod); add -- --from N to resume a pull
npm run sync:courseforum     # ratings for every course in the term (~20 min, cached)
npm run dev
```

Environment variables (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `DEFAULT_TERM` (`1272` = Spring 2027), `CRON_SECRET` (Vercel Cron sends it as a bearer token to `/api/sync`).

## Setup for students (no install)

Students use Claude, ChatGPT or Codex with the remote connector; `public/install.md` is the step-by-step guide and the walkthrough on the site shows the same steps (`components/Setup.tsx`, copy in `components/install-prompt.ts`).

1. Connect: the site's step 1 has a tab per app. Claude Code and Codex get a one-line prompt (`agentSetupPrompt` in components/install-prompt.ts) that runs `claude mcp add --scope user --transport http hoos-planner <url>` / `codex mcp add hoos-planner --url <url>`, then a restart. Otherwise add the remote connector `https://hoosplanner.zrk.ventures/api/mcp` (no auth) in the student's AI app: claude.ai (Settings → Connectors → Add custom connector), ChatGPT (Developer mode → Create connector, No authentication), or Codex (`codex mcp add hoos-planner --url …`, or Settings → MCP servers in the app). The site's setup steps have a picker for the three (`useAiApp` in `components/Setup.tsx`).
2. Open `/schedule`. The site issues a plan code (`components/plan-code.ts`, kept in localStorage) and shows a first message that carries it. The student pastes that into a new chat.
3. `save_plan` creates the plan under that code on Claude's first save, and the open pages (polling `/api/plans`) fill in.

## Install the full version (Mac, Claude Code)

The Mac version adds the `live_*` tools that read the student's own SIS and Stellic. Paste the advanced prompt from `public/install.md` into Claude Code, or run `curl -fsSL https://hoosplanner.zrk.ventures/install.sh | bash`.

`public/install.sh` clones this repo to `~/hoos-planner`, installs dependencies and browser-harness, writes a friend-mode `.env.local` (`HOOS_API=https://hoosplanner.zrk.ventures`, no database keys), registers the stdio server with Claude Code and the Claude desktop app, and runs the catalog self-test. Friend mode reads the catalog from `/api/catalog` and saves plan codes through `/api/plans`.

## Connecting Claude (MCP)

- **Live**: https://hoosplanner.zrk.ventures (MCP endpoint `https://hoosplanner.zrk.ventures/api/mcp`).
- **claude.ai**: Settings → Connectors → Add custom connector → URL `https://hoosplanner.zrk.ventures/api/mcp`, no auth.
- **Claude Code**: `claude mcp add --transport http hoos-planner https://hoosplanner.zrk.ventures/api/mcp`
- **Local stdio** (needs `.env.local`): `claude mcp add -s user -e LIVE_BROWSER=1 -e LIVE_WRITES=1 hoos-planner -- npx tsx /path/to/hoos-planner/scripts/mcp-stdio.ts` (drop the `-e` flags for catalog-only)
- Smoke test: `npx tsx scripts/mcp-smoke.ts http://localhost:3077/api/mcp` (HTTP) or `npx tsx scripts/mcp-smoke.ts stdio` (launches the stdio server from `/`).
- Editing the rules: change `lib/mcp/knowledge.md`, then `npm run build:knowledge` (the test suite fails if the generated module is stale).

The endpoint must be publicly reachable for claude.ai, so turn off Vercel Deployment Protection or use the production domain. Tools are read-only against the cached catalog except `save_plan`, which writes to `shared_plans` under a server-generated 80-bit code (the code is the only secret; it reads and updates that one plan). Inputs are size-capped; there is no per-client rate limit yet, so add a Vercel Firewall rate-limit rule on `/api/mcp` if usage grows.

Vercel: new projects ship with Deployment Protection (Vercel Authentication) on preview URLs, which blocks anyone outside the team. Turn it off in Project → Settings → Deployment Protection, or promote to production (`vercel --prod`) and share the production domain.

Supabase Auth: set the Site URL and add `https://<your-domain>/auth/callback` (and the Vercel preview pattern) to the redirect allow-list so magic links land on `/auth/callback`.

## Live tools (Phase 2, local only)

The stdio server also registers `live_*` tools when started with `LIVE_BROWSER=1` (cart add/delete need `LIVE_WRITES=1` as well) that read the student's **own signed-in Chrome** through [browser-harness](https://github.com/browser-use/browser-harness): `live_read_profile` (SIS unofficial transcript → profile), `live_read_stellic` (Stellic audit verdicts + courses), `live_read_cart` (SIS cart with rooms, Planner, enrollment dates), `live_validate_cart` (SIS's own OK-to-Add check), and `live_add_to_cart` / `live_delete_from_cart` (cart changes via the SIS page; both refuse without `confirm: true`). Setup: `pip install browser-harness` (or the installer in its README), open Chrome, enable *Allow remote debugging* at `chrome://inspect/#remote-debugging`, sign in to SIS and Stellic yourself. The tools never see or store NetBadge credentials or the SIS request token; they never press Enroll. Endpoint notes: `docs/live-endpoints.md`. The remote `/api/mcp` connector never has these tools.

## How the SIS pull works

`https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch?institution=UVA01&term=1272&page=N` returns 100 sections per page with `pageCount`. Optional filters: `subject=`, `crse_attr_value=AIP|CMP|CSW|HP|LS|SS|SES|QCD|R21C2|R21C1|WL`, `keyword=`. The endpoint returns a "CSA5" 403 without a PeopleSoft guest session, so `lib/sis.ts` first GETs the public landing page (`IScript_Main`) to collect cookies and reuses them. Rows are normalized in `normalizeSis` (meetings → `{days,start,end,start_dt,end_dt}` in minutes; attributes split into `attrs[]`) and upserted on `(term, class_nbr)`. Term halves (Q3/Q4) are inferred from section dates.

## Data model

`terms`, `sections` (all SIS fields incl. attributes, meetings, caps, enrollment, reserve caps, raw JSON), `courseforum_ratings` (course, instructor, rating, difficulty, gpa, last_term), `sync_log`, `user_plans` (profile JSON + cart JSON per user/term). Catalog tables are public-read; only the service role writes them.

## Tests

```bash
npm test          # meetings/conflicts, audit parser, requirements engine, search, MCP tools, live-runner (92 tests)
npx tsx scripts/search-matrix.ts   # every builder filter through the MCP server (read-only)
npx tsx scripts/cart-snapshot.ts out.json   # read-only snapshot of the live SIS cart + Planner, for before/after diffs
npm run typecheck
```

## Sources

`docs/` holds the planning brief and the three research files (College gen-ed rules, McIntire admission, SDS admission) with every source URL. The MCP server's `lib/mcp/knowledge.md` is a condensed version; update both when the Record changes.
