import "server-only";
import { createHash } from "node:crypto";
import { createOpenAIClient, getAIRequestTimeout, getOpenAIModel } from "@/lib/openai/client";
import { AI_PROMPT_VERSION, AI_SYSTEM_PROMPT, buildAILeadInput } from "@/lib/ai/prompts";
import { aiInsightJsonSchema, parseAIInsightOutput } from "@/lib/ai/schemas";
import type { AIInsightOutput, AILeadInput } from "@/types/ai";

export type AIProviderResult = { output: AIInsightOutput; model: string; inputTokens: number; outputTokens: number; latencyMs: number };
export type AIProviderMode = "openai" | "mock";

export class AIProviderError extends Error {
  constructor(public code: "configuration_missing" | "provider_timeout" | "provider_rate_limited" | "provider_error" | "malformed_output" | "model_refusal" | "network_error") { super(code); }
}

export function configuredProviderMode(): AIProviderMode | "missing" {
  return process.env.AI_PROVIDER === "openai" || process.env.AI_PROVIDER === "mock" ? process.env.AI_PROVIDER : "missing";
}

export function selectedAIModel() {
  return configuredProviderMode() === "mock" ? "leadpilot-deterministic-mock-v1" : getOpenAIModel();
}

export async function generateWithAIProvider(input: AILeadInput, correlationId: string, memberId: string): Promise<AIProviderResult> {
  const mode = configuredProviderMode();
  if (mode === "missing") throw new AIProviderError("configuration_missing");
  if (mode === "mock") {
    const mockAllowed = process.env.AI_MOCK_DEMO_ENABLED === "true"
      || process.env.AI_ALLOW_MOCK_IN_PRODUCTION_TESTS === "true";
    if (process.env.NODE_ENV === "production" && !mockAllowed) throw new AIProviderError("configuration_missing");
    return mockResult(input);
  }
  const started = Date.now();
  try {
    const client = createOpenAIClient();
    const response = await client.responses.create({
      model: getOpenAIModel(), instructions: AI_SYSTEM_PROMPT, input: buildAILeadInput(input),
      text: { format: aiInsightJsonSchema }, store: false, background: false,
      max_output_tokens: 1200, reasoning: { effort: "low" },
      safety_identifier: createHash("sha256").update(memberId).digest("hex").slice(0, 48),
      metadata: { correlation_id: correlationId, prompt_version: AI_PROMPT_VERSION },
    }, { signal: AbortSignal.timeout(getAIRequestTimeout()) });
    if (!response.output_text) throw new AIProviderError("model_refusal");
    let parsed: unknown;
    try { parsed = JSON.parse(response.output_text); } catch { throw new AIProviderError("malformed_output"); }
    const output = parseAIInsightOutput(parsed);
    if (!output) throw new AIProviderError("malformed_output");
    return { output, model: response.model, inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    const name = error instanceof Error ? error.name : "";
    const code = status === 429 ? "provider_rate_limited" : name === "TimeoutError" || name === "AbortError"
      ? "provider_timeout" : status >= 500 ? "provider_error" : "network_error";
    console.error("AI provider request failed", { correlationId, code, status });
    throw new AIProviderError(code);
  }
}

function mockResult(input: AILeadInput): AIProviderResult {
  const started = Date.now();
  if (input.notes?.includes("[mock:error]")) throw new AIProviderError("provider_error");
  const missing = [!input.property_size && "Property size", !input.expected_timeline && "Expected timeline", input.budget_pkr === 0 && "Budget"].filter(Boolean) as string[];
  const intent = input.rule_based_score >= 80 ? "high" : input.rule_based_score >= 60 ? "medium" : "low";
  const temperature = intent === "high" ? "hot" : intent === "medium" ? "warm" : "cold";
  const output: AIInsightOutput = {
    summary: `The lead is considering ${input.service_required.toLowerCase()} in ${input.location}. The available details indicate ${intent} buying intent, subject to human qualification.`,
    buying_intent: intent, recommended_temperature: temperature,
    recommended_score: Math.max(0, Math.min(100, input.rule_based_score + (missing.length ? -3 : 4))),
    score_factors: [`Rule-based score is ${input.rule_based_score}`, `Source is ${input.source}`, input.expected_timeline ? `Timeline provided: ${input.expected_timeline}` : "Timeline is not provided"],
    missing_information: missing, risk_flags: missing.length ? ["Qualification details are incomplete"] : [],
    recommended_next_action: "Confirm the missing qualification details and agree on a suitable consultation time.",
    suggested_reply: `Thank you for sharing your ${input.service_required.toLowerCase()} requirement. I would like to confirm a few details and discuss the most suitable next steps. Would a brief call be convenient?`,
    confidence: missing.length ? 0.72 : 0.86,
  };
  const validated = parseAIInsightOutput(output);
  if (!validated) throw new AIProviderError("malformed_output");
  return { output: validated, model: "leadpilot-deterministic-mock-v1", inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started };
}
