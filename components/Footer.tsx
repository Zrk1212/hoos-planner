import Link from "next/link";
import { LogoMark } from "./Logo";

const cols = [
  { h: "Your plan", links: [["/schedule", "Schedule"], ["/cart", "Cart"], ["/requirements", "Requirements"], ["/about", "About"]] },
  { h: "Policies", links: [["/privacy", "Privacy"], ["/terms", "Terms"], ["/security", "Security"]] },
  { h: "Source", links: [["https://github.com/Zrk1212/hoos-planner", "GitHub"], ["/install.md", "Setup guide"]] },
] as const;

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2 font-semibold"><LogoMark className="h-6 w-6" /> Hoos Planner</div>
          <p className="mt-3 text-muted">
            Plan in Claude, ChatGPT or Codex, see it here. Catalog cached nightly from the public SIS class search. No NetBadge,
            no passwords, and you press Enroll yourself.
          </p>
          <p className="mt-3 text-xs text-muted">Not affiliated with or endorsed by the University of Virginia.</p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <div className="font-medium">{c.h}</div>
            <ul className="mt-3 space-y-2 text-muted">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  {href.startsWith("http")
                    ? <a href={href} className="hover:text-ink" target="_blank" rel="noopener noreferrer">{label}</a>
                    : href.endsWith(".md") ? <a href={href} className="hover:text-ink">{label}</a>
                    : <Link href={href} className="hover:text-ink">{label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
