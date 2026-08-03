import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";

export const aiInsightColumns = "id,company_id,lead_id,generated_by_member_id,provider,model,prompt_version,input_fingerprint,status,generation_kind,summary,buying_intent,recommended_temperature,recommended_score,score_factors,missing_information,risk_flags,recommended_next_action,suggested_reply,confidence,error_code,created_at,completed_at" as const;

export function listRecentLeadAIInsights(client: AppSupabaseClient, companyId: string, leadId: string) {
  return client.from("lead_ai_insights").select(aiInsightColumns)
    .eq("company_id", companyId).eq("lead_id", leadId)
    .order("created_at", { ascending: false }).limit(10);
}

export function getAIUsageSummary(client: AppSupabaseClient, companyId: string) {
  return client.rpc("get_ai_usage_summary", { target_company_id: companyId });
}
