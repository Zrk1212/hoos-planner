"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="h-page">This page hit an error</h1>
      <p className="mt-3 text-muted">Your plan is saved on this device, so nothing is lost. Try loading the page again; if it keeps happening, go back to the start.</p>
      {error.digest && <p className="mono mt-2 text-xs text-muted">Reference {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn">Go to the start</Link>
      </div>
    </div>
  );
}
