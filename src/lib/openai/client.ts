import "server-only";
import OpenAI from "openai";

export const OPENAI_DEFAULT_MODEL = "gpt-5.6-terra";

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
}

export function getAIRequestTimeout() {
  const value = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30000);
  return Number.isInteger(value) && value >= 5000 && value <= 120000 ? value : 30000;
}

export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("configuration_missing");
  return new OpenAI({ apiKey, timeout: getAIRequestTimeout(), maxRetries: 1 });
}
