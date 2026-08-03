"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type LoginFormProps = {
  destination: string;
  message?: string;
};

export function LoginForm({ destination, message }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!email) nextErrors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) nextErrors.password = "Password is required.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setErrors({
        form: "The email or password is incorrect. Please try again.",
      });
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  const statusMessage =
    message === "password-updated"
      ? "Password updated successfully. Sign in with your new password."
      : message === "signed-out"
        ? "You have been signed out securely."
        : undefined;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#0b1830] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-20 size-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-blue-600 p-2.5"><Building2 /></span>
          <span className="text-xl font-extrabold">LeadPilot AI</span>
        </div>
        <div className="relative max-w-xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-200">
            <Sparkles className="size-3.5" /> Built for modern property teams
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight">
            Turn every inquiry into an opportunity.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-300">
            Keep every lead, follow-up, site visit and sales conversation moving
            forward from one focused workspace.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-5">
            {[
              "Prioritize high-intent leads",
              "Never miss a follow-up",
              "Track your whole pipeline",
              "Measure team performance",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <CheckCircle2 className="size-5 text-emerald-400" />{item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">
          © 2026 LeadPilot AI · Secure workspace
        </p>
      </section>
      <section className="flex items-center justify-center bg-white px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="rounded-xl bg-blue-600 p-2 text-white"><Building2 /></span>
            <b className="text-xl">LeadPilot AI</b>
          </div>
          <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <ShieldCheck />
          </span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back
          </h2>
          <p className="mt-2 text-slate-500">
            Sign in with your company account.
          </p>
          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            {statusMessage && (
              <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {statusMessage}
              </div>
            )}
            {errors.form && (
              <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {errors.form}
              </div>
            )}
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                required
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                type="email"
                autoComplete="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
              {errors.email && <p id="email-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.email}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password" className="label">Password</label>
                <Link href="/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  required
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="input pr-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p id="password-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.password}</p>}
            </div>
            <button disabled={loading} aria-busy={loading} className="btn-primary w-full py-3">
              {loading ? "Signing in securely..." : "Sign in to LeadPilot"}
            </button>
          </form>
          {destination.startsWith("/invitations/accept?") && <p className="mt-5 text-center text-sm text-slate-500">New to LeadPilot? <Link href={`/signup?next=${encodeURIComponent(destination)}`} className="font-bold text-blue-600">Create your invited account</Link></p>}
        </div>
      </section>
    </main>
  );
}
