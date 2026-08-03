import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";

export function listLeadActivities(
  client: AppSupabaseClient,
  companyId: string,
  leadId: string,
) {
  return client
    .from("lead_activities")
    .select("id,activity_type,description,metadata,occurred_at,actor_member_id")
    .eq("company_id", companyId)
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false });
}
