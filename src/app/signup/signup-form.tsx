"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SignupForm({ destination, email, companyName }: { destination: string; email: string; companyName: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card w-full max-w-md p-7">
    <span className="flex items-center gap-2 font-extrabold text-blue-700"><Building2 className="size-5" /> LeadPilot AI</span>
    <h1 className="mt-6 text-2xl font-extrabold">Create your invited account</h1>
    <p className="mt-2 text-sm text-slate-500">Join {companyName}. Your email is locked to this invitation.</p>
    <form className="mt-6 space-y-4" onSubmit={async event => {
      event.preventDefault(); setLoading(true); setError("");
      const { error: signupError } = await createBrowserSupabaseClient().auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (signupError) { setError(signupError.message); setLoading(false); return; }
      router.replace(destination); router.refresh();
    }}>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <label className="block"><span className="label">Full name</span><input required minLength={2} autoComplete="name" className="input" value={fullName} onChange={event => setFullName(event.target.value)} /></label>
      <label className="block"><span className="label">Invited email</span><input readOnly className="input bg-slate-100" value={email} /></label>
      <label className="block"><span className="label">Password</span><input required minLength={12} type="password" autoComplete="new-password" className="input" value={password} onChange={event => setPassword(event.target.value)} /><small className="mt-1 block text-slate-500">Use at least 12 characters.</small></label>
      <button disabled={loading} className="btn-primary w-full justify-center">{loading ? "Creating account…" : "Create account securely"}</button>
    </form>
  </section></main>;
}
