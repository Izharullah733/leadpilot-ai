import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AppSupabaseClient = SupabaseClient<Database>;

export function listTenants(client: AppSupabaseClient) {
  return client.rpc("list_my_tenants");
}

export function listMembers(client: AppSupabaseClient, companyId: string) {
  return client.rpc("list_company_members", { target_company_id: companyId });
}

export function listInvitations(client: AppSupabaseClient, companyId: string) {
  return client.rpc("list_company_invitations", { target_company_id: companyId });
}
