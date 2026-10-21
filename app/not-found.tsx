import Link from "next/link";
import { Rotunda } from "@/components/Rotunda";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <Rotunda className="mx-auto w-64 text-muted/70" />
      <h1 className="h-page mt-4">There&apos;s no page here</h1>
      <p className="mt-3 text-muted">The link may be old or mistyped. Your plan lives on the schedule page.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/schedule" className="btn btn-primary">Open your schedule</Link>
        <Link href="/" className="btn">Go to the start</Link>
      </div>
    </div>
  );
}
