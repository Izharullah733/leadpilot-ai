import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, ShieldAlert } from "lucide-react";
import { acceptInvitationAction } from "@/actions/invitation-acceptance-actions";
import { roleLabels } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; state?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const failed = (Array.isArray(params.state) ? params.state[0] : params.state) === "failed";
  const client = await createServerSupabaseClient();
  const { data: invitations } = token
    ? await client.rpc("inspect_company_invitation", { raw_token: token })
    : { data: null };
  const invitation = invitations?.[0];
  if (!token || !invitation || !invitation.is_valid || failed) {
    return <InvitationFrame><ShieldAlert className="size-8 text-rose-600" /><h1 className="mt-5 text-2xl font-extrabold">Invitation unavailable</h1><p className="mt-2 text-sm text-slate-500">This link is invalid, expired, revoked, already used, or could not be accepted. Ask a company administrator for a fresh invitation.</p><Link href="/login" className="btn-secondary mt-6 justify-center">Return to sign in</Link></InvitationFrame>;
  }
  const { data: { user } } = await client.auth.getUser();
  const next = `/invitations/accept?token=${encodeURIComponent(token)}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const emailMatches = user.email?.toLowerCase() === invitation.email.toLowerCase();
  return <InvitationFrame>
    <CheckCircle2 className="size-8 text-emerald-600" />
    <h1 className="mt-5 text-2xl font-extrabold">Join {invitation.company_name}</h1>
    <p className="mt-2 text-sm text-slate-500">You were invited as <b>{roleLabels[invitation.role]}</b> for <b>{invitation.email}</b>.</p>
    {!emailMatches ? <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">You are signed in as {user.email}. Sign out and use the invited email address.</div> :
      <form action={acceptInvitationAction} className="mt-6"><input type="hidden" name="token" value={token} /><button className="btn-primary w-full justify-center">Accept and open workspace</button></form>}
  </InvitationFrame>;
}

function InvitationFrame({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card w-full max-w-md p-7"><span className="mb-6 flex items-center gap-2 font-extrabold text-blue-700"><Building2 className="size-5" /> LeadPilot AI</span>{children}</section></main>;
}
