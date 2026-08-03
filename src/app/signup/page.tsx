import { redirect } from "next/navigation";
import { SignupForm } from "@/app/signup/signup-form";
import { getSafeInternalRedirect } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const destination = getSafeInternalRedirect(nextParam);
  if (!destination.startsWith("/invitations/accept?")) redirect("/login");
  const token = new URL(destination, "http://local").searchParams.get("token");
  const client = await createServerSupabaseClient();
  const { data: invitations } = token ? await client.rpc("inspect_company_invitation", { raw_token: token }) : { data: null };
  const invitation = invitations?.[0];
  if (!invitation?.is_valid) redirect("/invitations/accept?state=failed");
  return <SignupForm destination={destination} email={invitation.email} companyName={invitation.company_name} />;
}
