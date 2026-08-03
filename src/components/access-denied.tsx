import { Building2, ShieldAlert } from "lucide-react";

type AccessDeniedProps = {
  title: string;
  description: string;
  email?: string;
};

export function AccessDenied({
  title,
  description,
  email,
}: AccessDeniedProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="card w-full max-w-lg p-7 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <ShieldAlert className="size-7" />
        </span>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-blue-700">
          <Building2 className="size-4" />
          LeadPilot AI
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        {email && (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Signed in as <b className="text-slate-800">{email}</b>
          </p>
        )}
        <form action="/auth/logout" method="post" className="mt-6">
          <button className="btn-primary w-full" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
