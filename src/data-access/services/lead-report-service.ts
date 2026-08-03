import "server-only";
import { getLeadRowsForAggregates } from "@/data-access/repositories/leads";
import { listMembers } from "@/data-access/repositories/membership-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapLead, requireLeadContext } from "@/data-access/services/lead-service";
import type { LeadDto, LeadMetrics } from "@/types/leads";

function rangeBoundary(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  if (!end) return `${value}T00:00:00+05:00`;
  const date = new Date(`${value}T00:00:00+05:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function calculateLeadMetrics(leads: LeadDto[]): LeadMetrics {
  const converted = leads.filter(lead => lead.stage === "converted").length;
  return {
    total: leads.length,
    hot: leads.filter(lead => lead.temperature === "hot").length,
    warm: leads.filter(lead => lead.temperature === "warm").length,
    cold: leads.filter(lead => lead.temperature === "cold").length,
    converted,
    conversionRate: leads.length ? Math.round(converted / leads.length * 100) : 0,
    activePipeline: leads
      .filter(lead => !["converted", "lost"].includes(lead.stage))
      .reduce((total, lead) => total + lead.budget, 0),
  };
}

function grouped(leads: LeadDto[], key: (lead: LeadDto) => string) {
  const counts = new Map<string, number>();
  for (const lead of leads) counts.set(key(lead), (counts.get(key(lead)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getLeadReport(input?: { start?: string; end?: string }) {
  const auth = await requireLeadContext();
  const client = await createServerSupabaseClient();
  const [{ data: rows, error }, { data: members, error: memberError }] =
    await Promise.all([
      getLeadRowsForAggregates(
        client,
        auth.companyId,
        input?.start ? rangeBoundary(input.start) : undefined,
        input?.end ? rangeBoundary(input.end, true) : undefined,
      ),
      listMembers(client, auth.companyId),
    ]);
  if (error || memberError) throw new Error("Lead reporting data could not be loaded.");
  const names = new Map((members ?? []).map(member => [member.member_id, member.full_name]));
  const leads = (rows ?? []).map(row => mapLead(row, names));
  const performance = (members ?? [])
    .filter(member => member.membership_status === "active")
    .map(member => {
      const assigned = leads.filter(lead => lead.assignedMemberId === member.member_id);
      return {
        memberId: member.member_id,
        name: member.full_name,
        assigned: assigned.length,
        conversions: assigned.filter(lead => lead.stage === "converted").length,
        pipeline: assigned.filter(lead => !["converted", "lost"].includes(lead.stage)).reduce((sum, lead) => sum + lead.budget, 0),
        averageScore: assigned.length ? Math.round(assigned.reduce((sum, lead) => sum + lead.score, 0) / assigned.length) : 0,
      };
    })
    .sort((a, b) => b.conversions - a.conversions || b.averageScore - a.averageScore || a.name.localeCompare(b.name));

  const months = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.createdAt.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + 1);
  }
  return {
    auth,
    leads,
    metrics: calculateLeadMetrics(leads),
    sources: grouped(leads, lead => lead.source),
    services: grouped(leads, lead => lead.service),
    statuses: grouped(leads, lead => lead.temperature),
    stages: grouped(leads, lead => lead.stage),
    monthly: [...months.entries()].sort().map(([month, count]) => ({ month, count })),
    performance,
    topPerformer: performance[0]?.name ?? "No data",
    recent: [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  };
}
