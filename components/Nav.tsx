"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";
import { openWalkthrough } from "./Walkthrough";

const links = [
  { href: "/schedule", label: "Schedule" },
  { href: "/cart", label: "Cart" },
  { href: "/requirements", label: "Requirements" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const night = useOverHero(path);
  useEffect(() => { setMenu(false); }, [path]);

  const linkCls = (href: string) => {
    const on = path.startsWith(href);
    return `relative rounded-full px-3.5 py-1.5 transition-colors duration-200 ${on ? "lg-chip font-medium" : night ? "text-white/70 hover:text-white" : "text-muted hover:text-ink"}`;
  };
  const glass = `lg ${night ? "lg-night" : ""}`;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3">
      <div className={`${glass} pointer-events-auto mx-auto flex h-[3.6rem] max-w-5xl items-center gap-2 rounded-full pl-4 pr-2`}>
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight" aria-label="Hoos Planner home">
          <LogoMark className="h-8 w-8" /> <span className="hidden min-[380px]:inline">Hoos Planner</span>
        </Link>
        <nav aria-label="Main" className="mx-auto hidden items-center gap-0.5 text-sm md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls(l.href)} aria-current={path.startsWith(l.href) ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <button className="btn btn-primary btn-sm !px-3.5 !py-1.5" onClick={openWalkthrough}>Get started</button>
          <button className="lg-icon md:hidden" aria-expanded={menu} aria-controls="mobile-menu" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu(!menu)}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {menu ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>
      {menu && (
        <div id="mobile-menu" className={`${glass} pop-in pointer-events-auto mx-auto mt-2 max-w-5xl rounded-[26px] p-2 md:hidden`}>
          <nav aria-label="Main mobile" className="flex flex-col gap-0.5 text-[15px]">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`${linkCls(l.href)} !rounded-2xl !py-3`} aria-current={path.startsWith(l.href) ? "page" : undefined}>{l.label}</Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

/** True while the floating header sits over the landing page's night-sky hero, so it switches to dark glass. */
function useOverHero(path: string) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    // The page segment can stream in after the header mounts (route loading states), so look the hero up on
    // every check and re-check when the DOM changes, not only on scroll.
    let raf = 0;
    const check = () => {
      raf = 0;
      const hero = document.querySelector<HTMLElement>("[data-hero]");
      setOver(!!hero && hero.getBoundingClientRect().bottom > 72);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { mo.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(raf); };
  }, [path]);
  return over;
}
