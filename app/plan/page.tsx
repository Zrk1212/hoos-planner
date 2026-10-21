import type { Metadata } from "next";
import { PlanWithChat } from "@/components/PlanWithChat";

export const metadata: Metadata = { title: "Plan with ChatGPT", robots: { index: false } };

export default function Page() {
  return <PlanWithChat />;
}
