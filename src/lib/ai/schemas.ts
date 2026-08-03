import type { AICompanySettings, AIInsightOutput } from "@/types/ai";
import { aiAllowedRoles, defaultAICompanySettings } from "@/types/ai";

export const aiInsightJsonSchema = {
  type: "json_schema",
  name: "lead_ai_insight",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "buying_intent", "recommended_temperature", "recommended_score", "score_factors", "missing_information", "risk_flags", "recommended_next_action", "suggested_reply", "confidence"],
    properties: {
      summary: { type: "string", minLength: 10, maxLength: 1200 },
      buying_intent: { type: "string", enum: ["low", "medium", "high"] },
      recommended_temperature: { type: "string", enum: ["cold", "warm", "hot"] },
      recommended_score: { type: "integer", minimum: 0, maximum: 100 },
      score_factors: { type: "array", maxItems: 8, items: { type: "string", minLength: 2, maxLength: 180 } },
      missing_information: { type: "array", maxItems: 8, items: { type: "string", minLength: 2, maxLength: 180 } },
      risk_flags: { type: "array", maxItems: 8, items: { type: "string", minLength: 2, maxLength: 180 } },
      recommended_next_action: { type: "string", minLength: 5, maxLength: 600 },
      suggested_reply: { type: "string", minLength: 5, maxLength: 1200 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  },
} as const;

const exactKeys = Object.keys(aiInsightJsonSchema.schema.properties).sort();
const safeText = (value: unknown, min: number, max: number) => typeof value === "string" && value.trim().length >= min && value.trim().length <= max && !/[<>]/.test(value);
const safeList = (value: unknown) => Array.isArray(value) && value.length <= 8 && value.every(item => safeText(item, 2, 180));

export function parseAIInsightOutput(value: unknown): AIInsightOutput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(exactKeys)) return null;
  if (!safeText(item.summary, 10, 1200) || !["low", "medium", "high"].includes(String(item.buying_intent))) return null;
  if (!["cold", "warm", "hot"].includes(String(item.recommended_temperature))) return null;
  if (!Number.isInteger(item.recommended_score) || Number(item.recommended_score) < 0 || Number(item.recommended_score) > 100) return null;
  if (!safeList(item.score_factors) || !safeList(item.missing_information) || !safeList(item.risk_flags)) return null;
  if (!safeText(item.recommended_next_action, 5, 600) || !safeText(item.suggested_reply, 5, 1200)) return null;
  if (typeof item.confidence !== "number" || item.confidence < 0 || item.confidence > 1) return null;
  if (/\b(guarantee(?:d)?|definitely available|confirmed price|contractually promise)\b/i.test(String(item.suggested_reply))) return null;
  return {
    summary: String(item.summary).trim(), buying_intent: item.buying_intent as AIInsightOutput["buying_intent"],
    recommended_temperature: item.recommended_temperature as AIInsightOutput["recommended_temperature"],
    recommended_score: Number(item.recommended_score), score_factors: item.score_factors as string[],
    missing_information: item.missing_information as string[], risk_flags: item.risk_flags as string[],
    recommended_next_action: String(item.recommended_next_action).trim(), suggested_reply: String(item.suggested_reply).trim(),
    confidence: item.confidence,
  };
}

export function parseAICompanySettings(value: unknown): AICompanySettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultAICompanySettings;
  const item = value as Partial<AICompanySettings>;
  const roles = Array.isArray(item.allowed_roles) && item.allowed_roles.every(role => aiAllowedRoles.includes(role))
    ? [...new Set(item.allowed_roles)] : defaultAICompanySettings.allowed_roles;
  return {
    version: 1, enabled: item.enabled === true, allowed_roles: roles,
    model_reference: "environment_default",
    daily_company_limit: integer(item.daily_company_limit, 1, 1000, 50),
    monthly_company_limit: integer(item.monthly_company_limit, 1, 10000, 500),
    user_hourly_limit: integer(item.user_hourly_limit, 1, 100, 10),
    regeneration_cooldown_minutes: integer(item.regeneration_cooldown_minutes, 0, 1440, 5),
    max_concurrent: integer(item.max_concurrent, 1, 10, 2),
    data_minimization_acknowledged: item.data_minimization_acknowledged === true,
    disclaimer_enabled: item.disclaimer_enabled !== false, auto_generate_on_create: false,
  };
}

function integer(value: unknown, min: number, max: number, fallback: number) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
}
