import "server-only";
import { getLeadRowsForAggregates } from "@/data-access/repositories/leads";
import { listMembers } from "@/data-access/repositories/membership-repository";
import { requireLeadContext } from "@/data-access/services/lead-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { WorkflowLeadOption, WorkflowMemberOption } from "@/types/workflows";

export function dateKeyInTimeZone(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function getScheduleContext() {
  const auth = await requireLeadContext();
  const client = await createServerSupabaseClient();
  const [{ data: members, error: memberError }, { data: leads, error: leadError }, settings] =
    await Promise.all([
      listMembers(client, auth.companyId),
      getLeadRowsForAggregates(client, auth.companyId),
      client.from("company_settings").select("timezone").eq("company_id", auth.companyId).maybeSingle(),
    ]);
  if (memberError || leadError) throw new Error("Scheduling options could not be loaded.");
  const activeMembers: WorkflowMemberOption[] = (members ?? [])
    .filter(member => member.membership_status === "active")
    .map(member => ({ id: member.member_id, name: member.full_name }));
  const visibleLeads: WorkflowLeadOption[] = (leads ?? []).map(lead => ({
    id: lead.id,
    leadNumber: lead.lead_number,
    name: lead.full_name,
    location: lead.location,
    assignedMemberId: lead.assigned_member_id ?? auth.memberId,
  }));
  return {
    auth,
    client,
    members: activeMembers,
    leads: visibleLeads,
    timeZone: settings.data?.timezone || "Asia/Karachi",
  };
}
