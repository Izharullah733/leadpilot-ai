import { formatPakistanPhone, isPakistanPhone } from "@/lib/format";
import type { LeadStage, LeadTemperature } from "@/types/leads";

const temperatures = ["hot", "warm", "cold"] as const;
const stages = [
  "new_inquiry", "contacted", "qualified", "proposal_sent",
  "negotiation", "site_visit", "converted", "lost",
] as const;

export type LeadInput = {
  requestId: string;
  fullName: string;
  phone: string;
  email: string;
  service: string;
  location: string;
  propertySize: string;
  budget: number;
  timeline: string;
  source: string;
  assignedMemberId: string;
  score: number;
  temperature: LeadTemperature;
  stage: LeadStage;
  notes: string;
  expectedUpdatedAt?: string;
};

export type LeadValidation =
  | { success: true; data: LeadInput }
  | { success: false; fieldErrors: Record<string, string> };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseLeadForm(
  formData: FormData,
  mode: "create" | "edit",
): LeadValidation {
  const fieldErrors: Record<string, string> = {};
  const fullName = text(formData, "fullName");
  const phoneInput = text(formData, "phone");
  const email = text(formData, "email").toLowerCase();
  const service = text(formData, "service");
  const location = text(formData, "location");
  const propertySize = text(formData, "propertySize");
  const timeline = text(formData, "timeline");
  const source = text(formData, "source");
  const assignedMemberId = text(formData, "assignedMemberId");
  const notes = text(formData, "notes");
  const budget = Number(text(formData, "budget"));
  const score = Number(text(formData, "score") || (budget >= 30_000_000 ? 88 : budget >= 10_000_000 ? 72 : 60));
  const temperatureInput = text(formData, "temperature") || (score >= 80 ? "hot" : score >= 60 ? "warm" : "cold");
  const stageInput = text(formData, "stage") || "new_inquiry";

  if (fullName.length < 3 || fullName.length > 160) fieldErrors.fullName = "Enter a full name between 3 and 160 characters.";
  if (!isPakistanPhone(phoneInput)) fieldErrors.phone = "Enter a Pakistani number such as +92 300 1234567.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (service.length < 2 || service.length > 160) fieldErrors.service = "Select a valid service.";
  if (location.length < 2 || location.length > 240) fieldErrors.location = "Enter a valid location.";
  if (propertySize.length > 120) fieldErrors.propertySize = "Property size is too long.";
  if (!Number.isSafeInteger(budget) || budget < 100_000) fieldErrors.budget = "Enter an integer budget of at least PKR 100,000.";
  if (timeline.length > 100) fieldErrors.timeline = "Timeline is too long.";
  if (source.length < 2 || source.length > 100) fieldErrors.source = "Select a valid source.";
  if (!assignedMemberId) fieldErrors.assignedMemberId = "Select an active team member.";
  if (!Number.isInteger(score) || score < 0 || score > 100) fieldErrors.score = "Score must be from 0 to 100.";
  if (!temperatures.includes(temperatureInput as LeadTemperature)) fieldErrors.temperature = "Select a valid temperature.";
  if (!stages.includes(stageInput as LeadStage)) fieldErrors.stage = "Select a valid pipeline stage.";
  if (notes.length > 5000) fieldErrors.notes = "Notes cannot exceed 5,000 characters.";
  const requestId = text(formData, "requestId");
  if (mode === "create" && !/^[0-9a-f-]{36}$/i.test(requestId)) fieldErrors.form = "The form session expired. Reload and try again.";

  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  return {
    success: true,
    data: {
      requestId,
      fullName,
      phone: formatPakistanPhone(phoneInput),
      email,
      service,
      location,
      propertySize,
      budget,
      timeline,
      source,
      assignedMemberId,
      score,
      temperature: temperatureInput as LeadTemperature,
      stage: stageInput as LeadStage,
      notes,
      expectedUpdatedAt: text(formData, "expectedUpdatedAt") || undefined,
    },
  };
}
