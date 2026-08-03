import "server-only";
import { createHash } from "node:crypto";
import { listRecentLeadAIInsights } from "@/data-access/repositories/ai-insights";
import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";
import { configuredProviderMode } from "@/lib/ai/provider";
import { parseAICompanySettings } from "@/lib/ai/schemas";
import type { AuthContext } from "@/lib/auth";
import type { AIInsightDto, AILeadInput, AILeadView } from "@/types/ai";
import type { LeadDto } from "@/types/leads";

export function minimizedAILeadInput(lead: LeadDto): AILeadInput {
  return {
    lead_reference: lead.leadNumber,
    service_required: lead.service.trim(), location: lead.location.trim(),
    property_size: lead.propertySize.trim() || null, budget_pkr: lead.budget,
    expected_timeline: lead.timeline.trim() || null, source: lead.source.trim(),
    current_stage: lead.stage, current_temperature: lead.temperature,
    rule_based_score: lead.score, notes: lead.notes.trim() || null,
  };
}

export function aiInputFingerprint(input: AILeadInput) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function getAILeadView(
  client: AppSupabaseClient, auth: AuthContext, lead: LeadDto, rawSettings: unknown,
): Promise<AILeadView> {
  const settings = parseAICompanySettings(rawSettings);
  const currentFingerprint = aiInputFingerprint(minimizedAILeadInput(lead));
  const { data, error } = await listRecentLeadAIInsights(client, auth.companyId, lead.id);
  if (error) throw new Error("AI insight history could not be loaded.");
  const rows = data ?? [];
  const generating = rows.find(item => item.status === "generating");
  const successful = rows.find(item => item.status === "succeeded");
  const failed = rows.find(item => item.status === "failed");
  const insight: AIInsightDto | null = successful && successful.summary && successful.buying_intent
    && successful.recommended_temperature && successful.recommended_score !== null
    && successful.score_factors && successful.missing_information && successful.risk_flags
    && successful.recommended_next_action && successful.suggested_reply && successful.confidence !== null
    ? {
      id: successful.id, provider: successful.provider as "openai" | "mock", model: successful.model,
      promptVersion: successful.prompt_version, inputFingerprint: successful.input_fingerprint,
      generationKind: successful.generation_kind as "initial" | "regeneration", generatedAt: successful.completed_at ?? successful.created_at,
      summary: successful.summary, buying_intent: successful.buying_intent as AIInsightDto["buying_intent"],
      recommended_temperature: successful.recommended_temperature, recommended_score: successful.recommended_score,
      score_factors: successful.score_factors, missing_information: successful.missing_information,
      risk_flags: successful.risk_flags, recommended_next_action: successful.recommended_next_action,
      suggested_reply: successful.suggested_reply, confidence: Number(successful.confidence),
    } : null;
  const providerMode = configuredProviderMode();
  const roleAllowed = settings.allowed_roles.includes(auth.role);
  let state: AILeadView["state"] = "empty";
  if (!settings.enabled) state = "disabled";
  else if (providerMode === "missing" || providerMode === "openai" && !process.env.OPENAI_API_KEY) state = "not_configured";
  else if (generating) state = "generating";
  else if (insight) state = insight.inputFingerprint === currentFingerprint ? "ready" : "stale";
  else if (failed) state = "failed";
  return { auth, settings, state, currentFingerprint, insight,
    latestErrorCode: failed?.error_code ?? null, providerMode,
    canGenerate: settings.enabled && roleAllowed && providerMode !== "missing" && (providerMode !== "openai" || !!process.env.OPENAI_API_KEY) };
}
