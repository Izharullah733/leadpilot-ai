"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError("Password could not be updated. Request a new reset link.");
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/login?message=password-updated");
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      <div>
        <label htmlFor="new-password" className="label">New password</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="label">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className="input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      <button disabled={loading} aria-busy={loading} className="btn-primary w-full">
        {loading ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
