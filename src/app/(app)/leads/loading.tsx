export default function LeadsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading leads" className="space-y-5">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
