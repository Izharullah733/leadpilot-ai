"use client";

export default function LeadsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-extrabold">Leads could not be loaded</h1>
      <p className="mt-2 text-sm text-slate-600">
        Check the connection and try again. No lead data was changed.
      </p>
      <button type="button" className="btn-primary mt-6" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
