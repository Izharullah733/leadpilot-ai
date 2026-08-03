import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";

export const followUpColumns =
  "id,lead_id,assigned_member_id,due_at,status,priority,notes,completed_at,cancelled_at,created_at,updated_at" as const;

export function listFollowUps(
  client: AppSupabaseClient,
  companyId: string,
  limit = 200,
) {
  return client
    .from("follow_ups")
    .select(followUpColumns)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("due_at", { ascending: true })
    .limit(limit);
}

export function getFollowUp(
  client: AppSupabaseClient,
  companyId: string,
  followUpId: string,
) {
  return client
    .from("follow_ups")
    .select(followUpColumns)
    .eq("company_id", companyId)
    .eq("id", followUpId)
    .is("deleted_at", null)
    .maybeSingle();
}
