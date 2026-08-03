import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";
import { UpdatePasswordForm } from "@/app/update-password/update-password-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const params = await searchParams;
  const callbackError = Array.isArray(params.error)
    ? params.error[0]
    : params.error;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || callbackError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
        <section className="card w-full max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-amber-600" />
          <h1 className="mt-5 text-2xl font-extrabold">Reset link unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This password-reset session is missing, invalid, or expired. Request a new secure link.
          </p>
          <Link href="/forgot-password" className="btn-primary mt-6 flex justify-center">
            Request a new link
          </Link>
          <Link href="/login" className="mt-4 inline-flex text-sm font-bold text-blue-600">
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="card w-full max-w-md p-7 sm:p-9">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
          <Building2 className="size-4" /> LeadPilot AI
        </div>
        <h1 className="mt-6 text-2xl font-extrabold">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use at least 12 characters and avoid passwords used on other services.
        </p>
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
