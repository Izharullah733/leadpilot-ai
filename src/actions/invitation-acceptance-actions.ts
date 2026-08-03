"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { COMPANY_COOKIE } from "@/services/tenant-service";

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const client = await createServerSupabaseClient();
  const { data: companyId, error } = await client.rpc("accept_company_invitation", {
    raw_token: token,
  });
  if (error || !companyId) {
    redirect(`/invitations/accept?state=failed&token=${encodeURIComponent(token)}`);
  }
  (await cookies()).set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard?membership=accepted");
}
