import { cookies } from "next/headers";
import type { AuthContext, TenantOption } from "@/lib/auth";
import { listTenants } from "@/data-access/repositories/membership-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const COMPANY_COOKIE = "leadpilot_company";

export type TenantResolution =
  | { state: "anonymous" }
  | { state: "incomplete"; email?: string }
  | { state: "suspended"; email?: string }
  | { state: "no-membership"; email?: string }
  | { state: "active"; auth: AuthContext };

export async function resolveTenantContext(): Promise<TenantResolution> {
  const client = await createServerSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { state: "anonymous" };

  const [{ data: profile }, { data: tenants, error }] = await Promise.all([
    client.from("profiles").select("id,full_name,avatar_url").eq("id", user.id).maybeSingle(),
    listTenants(client),
  ]);
  if (!profile || error) return { state: "incomplete", email: user.email };

  const options: TenantOption[] = (tenants ?? []).map(item => ({
    companyId: item.company_id,
    companyName: item.company_name,
    memberId: item.member_id,
    role: item.role,
  }));
  if (!options.length) {
    const { data: contexts } = await client.rpc("get_my_auth_context");
    if (contexts?.some(item => item.membership_status === "suspended")) {
      return { state: "suspended", email: user.email };
    }
    return { state: "no-membership", email: user.email };
  }

  const preferred = (await cookies()).get(COMPANY_COOKIE)?.value;
  const selected = options.find(item => item.companyId === preferred) ?? options[0];
  return {
    state: "active",
    auth: {
      profileId: profile.id,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      memberId: selected.memberId,
      companyId: selected.companyId,
      companyName: selected.companyName,
      role: selected.role,
      tenants: options,
    },
  };
}
