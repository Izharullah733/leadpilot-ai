"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, KeyRound } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createBrowserSupabaseClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );
    setLoading(false);

    if (resetError) {
      setError("We could not start password recovery. Please try again.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="card w-full max-w-md p-7 sm:p-9">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
          <Building2 className="size-4" /> LeadPilot AI
        </div>
        <span className="mt-7 grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <KeyRound />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-900">
          Reset your password
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Enter your account email. If it exists, we will send a secure recovery link.
        </p>
        {sent ? (
          <div className="mt-6">
            <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-700">
              Check your inbox for password-reset instructions.
            </div>
            <Link href="/login" className="btn-primary mt-5 flex w-full justify-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
            <div>
              <label htmlFor="recovery-email" className="label">Email address</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <button disabled={loading} aria-busy={loading} className="btn-primary w-full">
              {loading ? "Sending secure link..." : "Send reset link"}
            </button>
            <Link href="/login" className="block text-center text-sm font-bold text-blue-600 hover:text-blue-700">
              Back to sign in
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
