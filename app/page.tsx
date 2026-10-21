import Link from "next/link";
import { Rotunda } from "@/components/Rotunda";
import { StarField } from "@/components/StarField";
import { ExampleDemo } from "@/components/ExampleDemo";
import { StartWalkthroughButton, Tilt } from "@/components/LandingBits";
import { loadTerm } from "@/lib/catalog";
import { siwcConfig } from "@/lib/siwc";

// Section count comes from the nightly sync; the page is re-rendered at most hourly.
export const revalidate = 3600;

const statsFor = (sections: number | null) => [
  { n: sections ? sections.toLocaleString("en-US") : "9,000+", t: "Spring 2027 sections", d: "The whole public SIS class search, refreshed every night." },
  { n: "1,200+", t: "Courses with Course Forum data", d: "Difficulty, rating and GPA, per instructor where students left reviews." },
  { n: "15", t: "Requirements tracked", d: "7 Disciplines, 4 Engagements, both writing requirements, World Language and QCD, plus McIntire and SDS prerequisites." },
];

const STEPS = [
  { t: "Connect Hoos Planner", d: "Add one link in Claude or ChatGPT settings, or paste one line into Claude Code or Codex and restart. Nothing downloads." },
  { t: "Paste your first message", d: "The site gives you a message with your own plan code. It links your chat to your schedule page." },
  { t: "Describe your week", d: "Ask for anything you'd ask an advisor. Your Schedule, Cart and Requirements pages update while you talk." },
];

const NEVER = [
  { t: "Ask for your NetBadge password.", d: "You never give Hoos Planner a password. Your AI reads the public class list, plus anything you paste into the chat." },
  { t: "Enroll you.", d: "You get class numbers in enroll order and paste them into SIS yourself, under Add by class number." },
  { t: "Touch your SIS cart.", d: "The connector can't reach SIS at all. Your real cart stays as you left it." },
];

export default async function Home() {
  const term = await loadTerm().catch(() => null);
  const STATS = statsFor(term?.section_count ?? null);
  // once OpenAI approves Sign in with ChatGPT, planning on the site becomes the first option
  const chatOn = siwcConfig().enabled;
  return (
    <div>
      {/* hero: night over the Lawn; runs up under the floating header */}
      <section data-hero className="bleed night-sky relative isolate -mt-24 overflow-hidden text-white">
        <StarField />
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-32 text-center sm:pt-40">
          <h1 className="display max-w-4xl text-[2.7rem] sm:text-7xl md:text-[5.25rem]">Your dream school with your dream&nbsp;schedule</h1>
          <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">Describe your schedule in plain English and watch Claude build it here, class by class.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {chatOn
              ? <Link href="/plan" className="btn btn-primary btn-lg">Plan with ChatGPT</Link>
              : <StartWalkthroughButton>Set it up in 2 minutes</StartWalkthroughButton>}
            {chatOn && <StartWalkthroughButton className="btn btn-lg !border-white/25 !bg-white/10 !text-white backdrop-blur hover:!bg-white/20">Use Claude</StartWalkthroughButton>}
            <a href="#examples" className="btn btn-lg !border-white/25 !bg-white/10 !text-white backdrop-blur hover:!bg-white/20">See examples</a>
          </div>
          <p className="mt-4 text-xs text-white/60">Hoos Planner is free. It works in Claude, ChatGPT or Codex.</p>
        </div>
        <Rotunda className="relative left-1/2 mt-8 block w-[max(760px,min(1080px,100%))] max-w-none -translate-x-1/2 text-[#fff4e6]/90 sm:mt-6" />
        {/* melt the Lawn into the page below */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[var(--bg)]" />
      </section>

      {/* examples */}
      <section id="examples" className="mx-auto mt-4 max-w-6xl scroll-mt-24 sm:mt-24">
        <h2 className="display text-3xl sm:text-5xl">Ask the way you&apos;d text a friend</h2>
        <p className="mt-3 max-w-2xl text-muted sm:text-lg">Pick a request. Claude answers with real Spring 2027 sections, and your Hoos Planner page fills in beside the chat.</p>
        <div className="sky relative mt-6 overflow-hidden rounded-[24px] p-2.5 sm:mt-8 sm:rounded-[28px] sm:p-8">
          <ExampleDemo />
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto mt-24 max-w-5xl">
        <h2 className="display text-3xl sm:text-5xl">Set up once, in about two minutes</h2>
        <p className="mt-3 max-w-xl text-muted sm:text-lg">You need Claude, ChatGPT (Plus or higher) or Codex. You don&apos;t need a Mac or anything installed.</p>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((x, k) => (
            <li key={x.t} className="glass !rounded-[24px] p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-fill)] text-sm font-semibold text-white">{k + 1}</span>
              <div className="mt-4 text-lg font-semibold tracking-tight">{x.t}</div>
              <p className="mt-1.5 text-[15px] leading-6 text-muted">{x.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6"><StartWalkthroughButton>Start setup</StartWalkthroughButton></div>
      </section>

      {/* the three pages */}
      <section className="mx-auto mt-24 max-w-5xl">
        <h2 className="display text-3xl sm:text-5xl">Three pages that keep up with the chat</h2>
        <p className="mt-3 max-w-xl text-muted sm:text-lg">SIS and Stellic show you one piece each. Hoos Planner puts your week, your cart and your requirements side by side.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Feature href="/schedule" art={<WeekArt />} lead="Schedule." body="Your week, color-coded, with conflicts in red and 7-week halves marked." />
          <Feature href="/cart" art={<CartArt />} lead="Cart." body="Times, rooms, instructors, seats and class numbers for every section. Backups get an orange badge." />
          <Feature href="/requirements" art={<AuditArt />} lead="Requirements." body="A Stellic-style checklist for the College, McIntire and the School of Data Science." />
        </div>
      </section>

      {/* stats */}
      <section className="mx-auto mt-24 grid max-w-5xl gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h2 className="display text-3xl sm:text-4xl">Real data behind every answer</h2>
          <p className="mt-3 max-w-sm text-muted">Your AI pulls from a nightly copy of the public SIS class search and theCourseForum, so the class numbers it gives you exist.</p>
        </div>
        <dl className="divide-y divide-line">
          {STATS.map((s) => (
            <div key={s.t} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-4 py-5 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="mono text-4xl font-semibold tracking-tight sm:text-5xl">{s.n}</dt>
              <dd><div className="text-lg font-medium sm:text-xl">{s.t}</div><p className="mt-1 text-sm text-muted">{s.d}</p></dd>
            </div>
          ))}
        </dl>
      </section>

      {/* never */}
      <section className="mx-auto mt-24 max-w-5xl">
        <div className="glass grid gap-8 !rounded-[28px] p-6 sm:p-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="display text-3xl sm:text-5xl">What it will never do</h2>
            <p className="mt-3 text-sm text-muted">Your UVA accounts stay yours.</p>
          </div>
          <ul className="space-y-5">
            {NEVER.map((x) => (
              <li key={x.t} className="flex gap-3">
                <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bad/10 text-bad">
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l6 6M9 3L3 9" /></svg>
                </span>
                <div><div className="font-medium">{x.t}</div><p className="mt-0.5 text-sm text-muted">{x.d}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto mt-24 flex max-w-5xl flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="display text-3xl sm:text-4xl">Plan your spring before your enrollment window opens.</h2>
          <p className="mt-2 text-lg text-muted">Two minutes of setup, then tell your AI what you want.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <StartWalkthroughButton>Set it up in 2 minutes</StartWalkthroughButton>
          <Link href="/about" className="btn btn-lg">Why I built this</Link>
        </div>
      </section>
    </div>
  );
}

function Feature({ href, art, lead, body }: { href: string; art: React.ReactNode; lead: string; body: string }) {
  return (
    <Link href={href} className="group block rounded-[24px] focus-visible:outline-offset-4">
      <Tilt className="rounded-[24px]">
        <div className="relative h-44 overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#e7ebf7,#d9def0)] p-5 ring-1 ring-line dark:bg-[linear-gradient(160deg,#16203a,#111a2e)]" aria-hidden>
          {art}
        </div>
      </Tilt>
      <p className="mt-4 text-[15px] leading-6 text-muted"><span className="font-medium text-ink group-hover:text-accent">{lead}</span> {body}</p>
    </Link>
  );
}

function AuditArt() {
  const rows: [string, string, string][] = [["Engaging Aesthetics", "done", "status-done"], ["Second Writing", "needed", "status-missing"], ["COMM 1800", "in progress", "status-in_progress"], ["DS 1001", "in cart", "status-planned"]];
  return (
    <div className="card mx-auto max-w-[15rem] p-3 text-[12px]">
      {rows.map(([l, s, c]) => <div key={l} className="flex justify-between border-b border-line/60 py-1 last:border-0"><span>{l}</span><span className={c}>{s}</span></div>)}
    </div>
  );
}

function WeekArt() {
  const blocks = [[0, 20, 22, "#2563eb"], [2, 20, 22, "#2563eb"], [1, 48, 18, "#e57200"], [3, 48, 18, "#e57200"], [0, 70, 16, "#1a7f4e"], [2, 70, 16, "#1a7f4e"], [4, 30, 20, "#7c5cd6"]];
  return (
    <div className="card mx-auto grid h-full max-w-[15rem] grid-cols-5 gap-1 p-2">
      {[0, 1, 2, 3, 4].map((d) => (
        <div key={d} className="relative rounded-md bg-chip/60">
          {blocks.filter((b) => b[0] === d).map((b, i) => <div key={i} className="absolute inset-x-0.5 rounded" style={{ top: `${b[1]}%`, height: `${b[2]}%`, background: b[3] as string, opacity: 0.85 }} />)}
        </div>
      ))}
    </div>
  );
}

function CartArt() {
  const rows: [string, string, boolean][] = [["DS 1002", "14431", false], ["KLPA 1105", "18012", false], ["KLPA 1410", "18030", true]];
  return (
    <div className="card mx-auto max-w-[15rem] p-3 text-[12px]">
      {rows.map(([c, n, b]) => (
        <div key={n} className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5 last:border-0">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" />{c}</span>
          <span className="flex items-center gap-1.5">{b && <span className="rounded-full bg-[#e57200]/15 px-1.5 text-[10px] font-semibold text-[#a85300]">Backup</span>}<span className="mono text-muted">#{n}</span></span>
        </div>
      ))}
    </div>
  );
}
