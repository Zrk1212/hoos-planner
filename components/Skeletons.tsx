/** Skeleton layouts that match the real pages, so content doesn't jump when it arrives. */
const Bar = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} />;

export function SectionRowSkeleton() {
  return (
    <div className="card flex gap-3 p-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex gap-2"><Bar className="h-4 w-24" /><Bar className="h-4 w-48 max-w-[50%]" /></div>
        <Bar className="h-3 w-3/4" />
        <div className="flex gap-1.5"><Bar className="h-4 w-14 !rounded-full" /><Bar className="h-4 w-20 !rounded-full" /></div>
      </div>
      <div className="flex w-16 shrink-0 flex-col items-end gap-1.5">
        <Bar className="h-3 w-12" /><Bar className="h-3 w-10" /><Bar className="h-6 w-14 !rounded-full" />
      </div>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div className="card space-y-3 p-3">
      <Bar className="h-3 w-32" />
      {[0, 1, 2].map((i) => <div key={i} className="flex justify-between"><Bar className="h-4 w-28" /><Bar className="h-4 w-12" /></div>)}
      <Bar className="h-7 w-36 !rounded-full" />
      <Bar className="h-40 w-full" />
    </div>
  );
}

export function BuilderSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]" aria-busy="true" aria-label="Loading the catalog">
      <span className="sr-only">Loading the catalog…</span>
      <aside className="min-w-0 lg:col-start-3 lg:row-start-1"><CartSkeleton /></aside>
      <aside className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-1">
        <Bar className="h-3 w-40" />
        <Bar className="h-9 w-full !rounded-xl" />
        {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-1.5"><Bar className="h-3 w-20" /><Bar className="h-9 w-full !rounded-xl" /></div>)}
        <div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <Bar key={i} className="h-7 w-9 !rounded-full" />)}</div>
      </aside>
      <section className="min-w-0 space-y-2 lg:col-start-2 lg:row-start-1">
        <Bar className="h-3 w-36" />
        {[0, 1, 2, 3, 4, 5].map((i) => <SectionRowSkeleton key={i} />)}
      </section>
    </div>
  );
}

export function RequirementsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="card space-y-2.5 p-3">
          <Bar className="h-3 w-28" />
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex justify-between"><Bar className="h-3.5 w-36 max-w-[60%]" /><Bar className="h-3.5 w-14" /></div>)}
        </div>
      ))}
    </div>
  );
}

export function AuditSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-busy="true" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      <div className="space-y-3">
        <Bar className="h-8 w-56" /><Bar className="h-3 w-full" /><Bar className="h-3 w-4/5" />
        <Bar className="h-72 w-full !rounded-2xl" />
        <div className="flex gap-2"><Bar className="h-8 w-20 !rounded-full" /><Bar className="h-8 w-28 !rounded-full" /></div>
      </div>
      <div className="space-y-3"><Bar className="h-8 w-48" /><Bar className="h-3 w-3/4" /><RequirementsSkeleton /></div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      <Bar className="h-9 w-72 max-w-full" /><Bar className="h-3 w-full" /><Bar className="h-3 w-5/6" />
      {[0, 1, 2].map((i) => <Bar key={i} className="h-36 w-full !rounded-2xl" />)}
    </div>
  );
}
