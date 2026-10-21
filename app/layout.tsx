import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PlanProvider } from "@/lib/plan-store";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SyncToaster, ToastProvider } from "@/components/Toast";
import { Walkthrough } from "@/components/Walkthrough";

// One typeface everywhere: Geist for headlines, body and numbers (tabular figures stand in for a mono face).
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hoosplanner.zrk.ventures";
const DESCRIPTION = "Describe your UVA schedule in plain English. Claude finds real Spring 2027 sections, checks conflicts and requirements for the College, McIntire and SDS, and builds your week on Hoos Planner.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Hoos Planner", template: "%s | Hoos Planner" },
  description: DESCRIPTION,
  applicationName: "Hoos Planner",
  openGraph: { type: "website", siteName: "Hoos Planner", title: "Hoos Planner", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary", title: "Hoos Planner", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geistSans.variable} data-scroll-behavior="smooth">
      <body className="antialiased min-h-screen flex flex-col">
        <PlanProvider>
          <ToastProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] btn">Skip to content</a>
            <Nav />
            <main id="main" className="flex-1 w-full max-w-7xl mx-auto px-4 pt-24 pb-6 min-w-0">{children}</main>
            <Footer />
            <Walkthrough />
            <SyncToaster />
          </ToastProvider>
        </PlanProvider>
      </body>
    </html>
  );
}
