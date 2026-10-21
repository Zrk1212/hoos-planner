import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

const ISSUES = "https://github.com/Zrk1212/hoos-planner/issues";

export default function Page() {
  return (
    <article className="card p-6 max-w-3xl mx-auto prose-like space-y-4 leading-relaxed">
      <h1 className="text-2xl font-semibold">Privacy</h1>
      <p className="text-sm opacity-70">Effective 2026-10-21</p>
      <p>Hoos Planner is a student-built course-planning tool. It is not affiliated with or endorsed by the University of Virginia. This page covers what it stores, what it never collects, and how to delete your plan.</p>

      <h2 className="text-lg font-semibold mt-6">What is stored</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Your plan, under a plan code.</strong> When Claude saves your plan, the server stores the class numbers, any backups, the programs you&apos;re aiming for, Claude&apos;s short notes, and, if you pasted your Stellic audit or transcript into the chat, the courses and grades Claude read from it. It sits under a random 20-character code with no name or email attached.</li>
        <li><strong>The code is the key.</strong> Anyone with your plan link or code can see and change that plan, so share it only with people you trust. Codes can&apos;t be listed or searched.</li>
        <li><strong>In your browser (local and session storage).</strong> Your plan codes (yours and the one you&apos;re viewing), which AI app you picked in setup, whether you&apos;ve seen the setup guide, and a cached copy of the class catalog. No grades or personal details.</li>
        <li><strong>If you sign in with ChatGPT on this site.</strong> Your ChatGPT account ID and email, plus the sign-in tokens that let Hoos Planner use your ChatGPT plan for your planning chat. The tokens are encrypted on the server and never sent to your browser. Your chat itself stays in your browser: OpenAI processes it, and Hoos Planner doesn&apos;t store it. Signing out deletes the tokens; unused sign-ins expire after 30 days.</li>
        <li><strong>Public catalog data.</strong> Class sections, term dates and course ratings. None of it is personal.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">What is never collected</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>NetBadge or Duo credentials, or any password. Hoos Planner never signs in to SIS, Stellic or anything else for you.</li>
        <li>Your SIS or Stellic sessions. The Claude app connector can&apos;t reach SIS or Stellic at all. The optional Mac version reads them through your own signed-in Chrome on your own computer, and that session never leaves your machine.</li>
        <li>Your name or email. No advertising, no analytics trackers, and no sale of data.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Third parties</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Your AI provider</strong> (Anthropic for Claude and Claude Code, OpenAI for ChatGPT and Codex) sees your conversation, including anything you paste, under your own account and that company&apos;s terms.</li>
        <li><strong>Supabase</strong> stores the database.</li>
        <li><strong>Vercel</strong> hosts the site and keeps ordinary request logs (IP address, browser).</li>
        <li><strong>UVA&apos;s public class search</strong> and <strong>theCourseForum</strong> are read once a night by the server to refresh the catalog. No student data is sent to either.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Deleting your plan</h2>
      <p>Open your plan on the Schedule, Cart or Requirements page and click <strong>Delete plan</strong>. It&apos;s removed from the server right away. Plans you don&apos;t delete stay on the server. Questions: <a className="underline" href={ISSUES}>open an issue on GitHub</a> (don&apos;t post your plan code there).</p>

      <h2 className="text-lg font-semibold mt-6">Your grades</h2>
      <p>Grades and course history you paste are used only to check your requirements. They aren&apos;t shared with other users or with UVA. Hoos Planner is not a UVA system and holds no official records.</p>

      <h2 className="text-lg font-semibold mt-6">No enrollment</h2>
      <p>Hoos Planner never enrolls you. You add classes in SIS yourself.</p>
    </article>
  );
}
