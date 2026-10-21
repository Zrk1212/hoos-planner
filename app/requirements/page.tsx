import type { Metadata } from "next";
import { RequirementsPage } from "@/components/RequirementsPage";

export const metadata: Metadata = { title: "Requirements", robots: { index: false, follow: true } };
export default function Page() { return <RequirementsPage />; }
