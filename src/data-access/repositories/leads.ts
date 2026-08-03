import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";
import type { LeadListQuery } from "@/types/leads";

export const leadColumns = "id,lead_number,full_name,phone,email,service_required,location,property_size,budget_pkr,expected_timeline,source,assigned_member_id,score,temperature,stage,notes,converted_at,created_at,updated_at" as const;

export async function listLeads(
  client: AppSupabaseClient,
  companyId: string,
  input: LeadListQuery,
) {
  let query = client
    .from("leads")
    .select(leadColumns, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (input.search) {
    const escaped = input.search.replace(/[%_,()]/g, "");
    query = query.or(
      `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,location.ilike.%${escaped}%,service_required.ilike.%${escaped}%`,
    );
  }
  if (input.temperature) query = query.eq("temperature", input.temperature);
  if (input.source) query = query.eq("source", input.source);
  if (input.assignedMemberId) {
    query = query.eq("assigned_member_id", input.assignedMemberId);
  }
  if (input.stage) query = query.eq("stage", input.stage);

  const orderColumn =
    input.sort === "budget"
      ? "budget_pkr"
      : input.sort === "date"
        ? "created_at"
        : "score";
  const start = (input.page - 1) * input.pageSize;
  return query
    .order(orderColumn, { ascending: false })
    .order("id", { ascending: true })
    .range(start, start + input.pageSize - 1);
}

export function getLead(
  client: AppSupabaseClient,
  companyId: string,
  reference: string,
) {
  let query = client
    .from("leads")
    .select(leadColumns)
    .eq("company_id", companyId)
    .is("deleted_at", null);
  query = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(reference)
    ? query.eq("id", reference)
    : query.eq("lead_number", reference);
  return query.maybeSingle();
}

export function getLeadRowsForAggregates(
  client: AppSupabaseClient,
  companyId: string,
  start?: string,
  end?: string,
) {
  let query = client
    .from("leads")
    .select(leadColumns)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lt("created_at", end);
  return query;
}
