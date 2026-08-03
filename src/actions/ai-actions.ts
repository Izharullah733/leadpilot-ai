"use server";

import { revalidatePath } from "next/cache";
import { getLead } from "@/data-access/repositories/leads";
import { getCompanySettings } from "@/data-access/repositories/settings";
import { aiInputFingerprint, minimizedAILeadInput } from "@/data-access/services/ai-lead-service";
import { mapLead, requireLeadContext } from "@/data-access/services/lead-service";
import { AI_PROMPT_VERSION } from "@/lib/ai/prompts";
import { AIProviderError, configuredProviderMode, generateWithAIProvider, selectedAIModel } from "@/lib/ai/provider";
import { parseAICompanySettings } from "@/lib/ai/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AIActionResult } from "@/types/ai";
import { aiAllowedRoles, type AICompanySettings } from "@/types/ai";
import type { Json } from "@/types/database";

function refresh(leadId: string) {
  revalidatePath(`/leads/${leadId}`); revalidatePath("/leads");
  revalidatePath("/dashboard"); revalidatePath("/reports"); revalidatePath("/team");
}

function generationError(message = ""): AIActionResult {
  if (message.includes("disabled")) return { ok: false, message: "AI assistance is disabled for this company.", state: "disabled" };
  if (message.includes("cooldown")) return { ok: false, message: "Please wait before regenerating this insight.", state: "ready" };
  if (message.includes("daily") || message.includes("monthly") || message.includes("hourly")) return { ok: false, message: "The configured AI request limit has been reached.", state: "failed" };
  if (message.includes("concurrent") || message.includes("generating")) return { ok: false, message: "An AI insight is already being generated. Try again shortly.", state: "generating" };
  if (message.includes("not allowed") || message.includes("not permitted")) return { ok: false, message: "Your role cannot generate an insight for this lead." };
  return { ok: false, message: "The AI insight could not be generated. The lead was not changed.", state: "failed" };
}

export async function generateAIInsightAction(leadId: string, forceRegeneration = false): Promise<AIActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return { ok: false, message: "Invalid lead." };
  let insightId = ""; let started = Date.now();
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const [{ data: row, error }, { data: companySettings, error: settingsError }] = await Promise.all([
      getLead(client, auth.companyId, leadId), getCompanySettings(client, auth.companyId),
    ]);
    if (error || !row) return { ok: false, message: "This lead is unavailable." };
    if (settingsError || !companySettings) return { ok: false, message: "AI company settings are unavailable." };
    const settings = parseAICompanySettings(companySettings.ai_settings);
    if (!settings.enabled) return generationError("disabled");
    if (!settings.allowed_roles.includes(auth.role)) return generationError("not allowed");
    const provider = configuredProviderMode();
    if (provider === "missing" || provider === "openai" && !process.env.OPENAI_API_KEY) return { ok: false, message: "AI provider configuration is missing.", state: "not_configured" };
    const lead = mapLead(row, new Map([[row.assigned_member_id ?? "", "Assigned member"]]));
    const input = minimizedAILeadInput(lead);
    const fingerprint = aiInputFingerprint(input);
    const model = selectedAIModel();
    const { data: begun, error: beginError } = await client.rpc("begin_ai_generation", {
      target_company_id: auth.companyId, target_lead_id: lead.id,
      requested_fingerprint: fingerprint, requested_model: model, requested_provider: provider,
      requested_prompt_version: AI_PROMPT_VERSION, force_regeneration: forceRegeneration,
    });
    if (beginError) return generationError(beginError.message);
    const state = begun && typeof begun === "object" && !Array.isArray(begun) ? String((begun as Record<string, unknown>).state ?? "") : "";
    if (state === "reused") { refresh(lead.id); return { ok: true, message: "Current AI insight reused; lead data has not changed.", state: "ready", reused: true }; }
    if (state === "generating") return generationError("generating");
    insightId = String((begun as Record<string, unknown>).insight_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(insightId)) return generationError();
    started = Date.now();
    try {
      const generated = await generateWithAIProvider(input, insightId, auth.memberId);
      const output = generated.output;
      const { data: completed, error: completeError } = await client.rpc("complete_ai_generation", {
        target_company_id: auth.companyId, target_insight_id: insightId,
        output_summary: output.summary, output_buying_intent: output.buying_intent,
        output_temperature: output.recommended_temperature, output_score: output.recommended_score,
        output_score_factors: output.score_factors, output_missing_information: output.missing_information,
        output_risk_flags: output.risk_flags, output_next_action: output.recommended_next_action,
        output_suggested_reply: output.suggested_reply, output_confidence: output.confidence,
        usage_input_tokens: generated.inputTokens, usage_output_tokens: generated.outputTokens,
        request_latency_ms: generated.latencyMs,
      });
      if (completeError || !completed) return generationError(completeError?.message);
      refresh(lead.id);
      return { ok: true, message: provider === "mock" ? "Mock AI insight generated for testing." : "AI insight generated.", state: "ready" };
    } catch (error) {
      const code = error instanceof AIProviderError ? error.code : "provider_error";
      await client.rpc("fail_ai_generation", { target_company_id: auth.companyId,
        target_insight_id: insightId, safe_error_code: code, request_latency_ms: Date.now() - started });
      console.error("AI generation failed safely", { correlationId: insightId, code });
      refresh(lead.id);
      return code === "configuration_missing" ? { ok: false, message: "AI provider configuration is missing.", state: "not_configured" }
        : code === "provider_rate_limited" ? { ok: false, message: "The AI provider is rate limited. Try again later.", state: "failed" }
          : code === "provider_timeout" ? { ok: false, message: "The AI request timed out. You can retry safely.", state: "failed" }
            : generationError();
    }
  } catch (error) { return generationError(error instanceof Error ? error.message : ""); }
}

export async function applyAIRecommendationAction(
  leadId: string, insightId: string, kind: "score" | "temperature", confirmed: boolean,
): Promise<AIActionResult> {
  if (!confirmed) return { ok: false, message: "Confirm the recommendation before applying it." };
  if (!/^[0-9a-f-]{36}$/i.test(leadId) || !/^[0-9a-f-]{36}$/i.test(insightId)) return { ok: false, message: "Invalid AI recommendation." };
  try {
    const auth = await requireLeadContext(); const client = await createServerSupabaseClient();
    const { error } = await client.rpc("apply_ai_recommendation", {
      target_company_id: auth.companyId, target_lead_id: leadId,
      target_insight_id: insightId, recommendation_kind: kind,
    });
    if (error) return { ok: false, message: "The recommendation could not be applied. The lead was not changed." };
    refresh(leadId);
    return { ok: true, message: kind === "score" ? "AI score recommendation applied." : "AI temperature recommendation applied." };
  } catch { return { ok: false, message: "The recommendation could not be applied. The lead was not changed." }; }
}

export async function updateCompanyAISettingsAction(formData: FormData): Promise<AIActionResult> {
  try {
    const parsed = JSON.parse(String(formData.get("aiSettings") ?? "")) as Partial<AICompanySettings>;
    const settings: AICompanySettings = {
      version: 1, enabled: parsed.enabled === true,
      allowed_roles: Array.isArray(parsed.allowed_roles) ? [...new Set(parsed.allowed_roles.filter(role => aiAllowedRoles.includes(role)))] : [],
      model_reference: "environment_default",
      daily_company_limit: Number(parsed.daily_company_limit), monthly_company_limit: Number(parsed.monthly_company_limit),
      user_hourly_limit: Number(parsed.user_hourly_limit), regeneration_cooldown_minutes: Number(parsed.regeneration_cooldown_minutes),
      max_concurrent: Number(parsed.max_concurrent), data_minimization_acknowledged: parsed.data_minimization_acknowledged === true,
      disclaimer_enabled: parsed.disclaimer_enabled !== false, auto_generate_on_create: false,
    };
    if (!settings.allowed_roles.length || !Number.isInteger(settings.daily_company_limit) || settings.daily_company_limit < 1 || settings.daily_company_limit > 1000
      || !Number.isInteger(settings.monthly_company_limit) || settings.monthly_company_limit < settings.daily_company_limit || settings.monthly_company_limit > 10000
      || !Number.isInteger(settings.user_hourly_limit) || settings.user_hourly_limit < 1 || settings.user_hourly_limit > 100
      || !Number.isInteger(settings.regeneration_cooldown_minutes) || settings.regeneration_cooldown_minutes < 0 || settings.regeneration_cooldown_minutes > 1440
      || !Number.isInteger(settings.max_concurrent) || settings.max_concurrent < 1 || settings.max_concurrent > 10
      || settings.enabled && !settings.data_minimization_acknowledged) {
      return { ok: false, message: "Correct the AI settings before saving." };
    }
    const auth = await requireLeadContext(); const client = await createServerSupabaseClient();
    const { error } = await client.rpc("update_company_ai_settings", {
      target_company_id: auth.companyId, expected_updated_at: String(formData.get("settingsUpdatedAt") ?? ""),
      requested_settings: settings as unknown as Json,
    });
    if (error?.message.includes("changed by another")) return { ok: false, message: "Settings changed in another session. Reload before saving." };
    if (error?.message.includes("not permitted")) return { ok: false, message: "Only an owner or admin can change AI settings." };
    if (error) return { ok: false, message: "AI settings could not be saved." };
    revalidatePath("/settings"); revalidatePath("/", "layout");
    return { ok: true, message: "AI settings saved." };
  } catch { return { ok: false, message: "AI settings could not be saved." }; }
}
