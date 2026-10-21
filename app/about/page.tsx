import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { StartWalkthroughButton } from "@/components/LandingBits";

export const metadata: Metadata = { title: "About", description: "Who built Hoos Planner, and why." };

// Portrait at public/about/zac.jpg (metadata stripped); without it the page shows a monogram.
const PHOTO = "/about/zac.jpg";
const hasPhoto = fs.existsSync(path.join(process.cwd(), "public", PHOTO));

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-10">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-12">
        <div className="relative mx-auto w-full max-w-xs">
          <div aria-hidden className="absolute -inset-4 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,rgb(229_114_0/0.28),transparent_70%)] blur-xl" />
          <div className="glass aspect-[768/930] overflow-hidden !rounded-[32px] p-2">
            {hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={PHOTO} alt="Zac Klein" className="h-full w-full rounded-[26px] object-cover object-top" />
            ) : (
              <div className="night-sky grid h-full w-full place-items-center rounded-[26px] text-white" role="img" aria-label="Zac Klein">
                <span className="display text-7xl">ZK</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="label">About</p>
          <h1 className="display mt-2 text-5xl sm:text-6xl">Hi, I&apos;m Zac.</h1>
          <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-muted">
            <p>
              I&apos;m a first-year in the College at UVA, aiming for McIntire and the School of Data Science. Planning my
              spring meant a dozen tabs: Stellic for what I still owed, SIS for sections, Course Forum for which professors
              to avoid, and a notes app to check that nothing overlapped across the 7-week halves.
            </p>
            <p>
              So I built the thing I wanted: tell your AI what you want your semester to look like, and watch it come
              together here. It never asks for your NetBadge password, and you&apos;re the one who presses Enroll.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <StartWalkthroughButton>Try it</StartWalkthroughButton>
            <a href="https://github.com/Zrk1212/hoos-planner" target="_blank" rel="noopener noreferrer" className="btn btn-lg">Read the code</a>
          </div>
          <p className="mt-6 text-xs text-muted">Hoos Planner is a student project. It isn&apos;t affiliated with or endorsed by the University of Virginia.</p>
        </div>
      </div>
    </div>
  );
}
