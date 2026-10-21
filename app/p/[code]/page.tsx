import { redirect } from "next/navigation";

// Links from the first version of save_plan; the live pages now live under /schedule.
export default async function OldPlanLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(/^[a-f0-9]{20}$/.test(code) ? `/schedule?plan=${code}` : "/schedule");
}
