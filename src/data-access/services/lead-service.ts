import "server-only";
import { redirect } from "next/navigation";
import {
  getLead,
  getLeadRowsForAggregates,
  listLeads,
} from "@/data-access/repositories/leads";
import { listLeadActivities } from "@/data-access/repositories/lead-activities";
import { listMembers, type AppSupabaseClient } from "@/data-access/repositories/membership-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveTenantContext } from "@/services/tenant-service";
import { getCompanySettings } from "@/data-access/repositories/settings";
import type {
  LeadActivityDto,
  LeadDto,
  LeadListQuery,
  LeadMemberOption,
} from "@/types/leads";
import { getAILeadView } from "@/data-access/services/ai-lead-service";

type RawLead = Awaited<ReturnType<typeof getLeadRowsForAggregates>>["data"] extends
  (infer Row)[] | null ? Row : never;

export async function requireLeadContext() {
  const resolution = await resolveTenantContext();
  if (resolution.state !== "active") {
    redirect("/account-access");
  }
  return resolution.auth;
}

export function mapLead(
  row: RawLead,
  memberNames: Map<string, string>,
): LeadDto {
  return {
    id: row.id,
    leadNumber: row.lead_number,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email ?? "",
    service: row.service_required,
    location: row.location,
    propertySize: row.property_size ?? "",
    budget: Number(row.budget_pkr),
    timeline: row.expected_timeline ?? "",
    source: row.source,
    assignedMemberId: row.assigned_member_id ?? "",
    salesperson: row.assigned_member_id
      ? memberNames.get(row.assigned_member_id) ?? "Unassigned"
      : "Unassigned",
    score: row.score,
    temperature: row.temperature,
    stage: row.stage,
    notes: row.notes ?? "",
    convertedAt: row.converted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMemberOptions(
  client: AppSupabaseClient,
  companyId: string,
): Promise<LeadMemberOption[]> {
  let { data, error } = await listMembers(client, companyId);
  if (error) {
    // A local/hosted PostgREST connection can occasionally fail during rapid
    // navigation. Retry the identical, RLS-scoped read once; persistent auth,
    // permission, or database errors still fail closed below.
    ({ data, error } = await listMembers(client, companyId));
  }
  if (error) throw new Error("Team members could not be loaded.");
  return (data ?? [])
    .filter(member => member.membership_status === "active")
    .map(member => ({
      id: member.member_id,
      name: member.full_name,
      role: member.role,
    }));
}

export async function getLeadList(input: LeadListQuery) {
  const auth = await requireLeadContext();
  const client = await createServerSupabaseClient();
  const members = await getMemberOptions(client, auth.companyId);
  const { data, count, error } = await listLeads(
    client,
    auth.companyId,
    input,
  );
  if (error) throw new Error("Leads could not be loaded.");
  const names = new Map(members.map(member => [member.id, member.name]));
  const total = count ?? 0;
  return {
    auth,
    members,
    result: {
      leads: (data ?? []).map(row => mapLead(row, names)),
      total,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    },
  };
}

export async function getLeadDetail(reference: string) {
  const auth = await requireLeadContext();
  const client = await createServerSupabaseClient();
  const members = await getMemberOptions(client, auth.companyId);
  const names = new Map(members.map(member => [member.id, member.name]));
  const [{ data: row, error }, { data: settings, error: settingsError }] = await Promise.all([
    getLead(client, auth.companyId, reference),
    getCompanySettings(client, auth.companyId),
  ]);
  if (error || !row) return null;
  if (settingsError || !settings) throw new Error("Company lead options could not be loaded.");
  const { data: activities, error: activityError } = await listLeadActivities(
    client,
    auth.companyId,
    row.id,
  );
  if (activityError) throw new Error("Lead activity could not be loaded.");
  const lead = mapLead(row, names);
  const ai = await getAILeadView(client, auth, lead, settings.ai_settings);
  return {
    auth,
    members,
    lead,
    ai,
    activities: (activities ?? []).map((activity): LeadActivityDto => ({
      id: activity.id,
      type: activity.activity_type,
      description: activity.description ?? "Lead activity",
      metadata:
        activity.metadata && typeof activity.metadata === "object" && !Array.isArray(activity.metadata)
          ? activity.metadata as Record<string, unknown>
          : {},
      occurredAt: activity.occurred_at,
      actorName: activity.actor_member_id
        ? names.get(activity.actor_member_id) ?? "Team member"
        : "System",
    })),
    services: settings.services.filter(item => !settings.disabled_services.includes(item)),
    sources: settings.lead_sources.filter(item => !settings.disabled_lead_sources.includes(item)),
  };
}

export async function getLeadFormOptions() {
  const auth = await requireLeadContext();
  const client = await createServerSupabaseClient();
  const [members, { data: settings, error }] = await Promise.all([
    getMemberOptions(client, auth.companyId),
    getCompanySettings(client, auth.companyId),
  ]);
  if (error || !settings) throw new Error("Company lead options could not be loaded.");
  return {
    auth,
    members,
    services: settings.services.filter(item => !settings.disabled_services.includes(item)),
    sources: settings.lead_sources.filter(item => !settings.disabled_lead_sources.includes(item)),
  };
}
