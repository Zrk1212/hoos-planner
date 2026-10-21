import type { Metadata } from "next";
import { SchedulePage } from "@/components/SchedulePage";

export const metadata: Metadata = { title: "Schedule", robots: { index: false, follow: true } };
export default function Page() { return <SchedulePage />; }
