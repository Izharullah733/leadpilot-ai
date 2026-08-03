import type { AuthContext, MemberRole } from "@/lib/auth";
import type { LeadTemperature } from "@/types/leads";

export const aiAllowedRoles: MemberRole[] = ["owner", "admin", "sales_manager", "sales_representative"];

export type AICompanySettings = {
  version: 1;
  enabled: boolean;
  allowed_roles: MemberRole[];
  model_reference: "environment_default";
  daily_company_limit: number;
  monthly_company_limit: number;
  user_hourly_limit: number;
  regeneration_cooldown_minutes: number;
  max_concurrent: number;
  data_minimization_acknowledged: boolean;
  disclaimer_enabled: boolean;
  auto_generate_on_create: false;
};

export const defaultAICompanySettings: AICompanySettings = {
  version: 1,
  enabled: false,
  allowed_roles: aiAllowedRoles,
  model_reference: "environment_default",
  daily_company_limit: 50,
  monthly_company_limit: 500,
  user_hourly_limit: 10,
  regeneration_cooldown_minutes: 5,
  max_concurrent: 2,
  data_minimization_acknowledged: false,
  disclaimer_enabled: true,
  auto_generate_on_create: false,
};

export type AILeadInput = {
  lead_reference: string;
  service_required: string;
  location: string;
  property_size: string | null;
  budget_pkr: number;
  expected_timeline: string | null;
  source: string;
  current_stage: string;
  current_temperature: LeadTemperature;
  rule_based_score: number;
  notes: string | null;
};

export type AIInsightOutput = {
  summary: string;
  buying_intent: "low" | "medium" | "high";
  recommended_temperature: LeadTemperature;
  recommended_score: number;
  score_factors: string[];
  missing_information: string[];
  risk_flags: string[];
  recommended_next_action: string;
  suggested_reply: string;
  confidence: number;
};

export type AIInsightDto = AIInsightOutput & {
  id: string;
  provider: "openai" | "mock";
  model: string;
  promptVersion: string;
  inputFingerprint: string;
  generationKind: "initial" | "regeneration";
  generatedAt: string;
};

export type AILeadView = {
  auth: AuthContext;
  settings: AICompanySettings;
  state: "disabled" | "not_configured" | "empty" | "generating" | "ready" | "stale" | "failed";
  currentFingerprint: string;
  insight: AIInsightDto | null;
  latestErrorCode: string | null;
  providerMode: "openai" | "mock" | "missing";
  canGenerate: boolean;
};

export type AIActionResult = {
  ok: boolean;
  message: string;
  state?: AILeadView["state"];
  reused?: boolean;
};
