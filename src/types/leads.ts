import type { Database } from "@/types/database";

export type LeadTemperature = Database["public"]["Enums"]["lead_temperature"];
export type LeadStage = Database["public"]["Enums"]["lead_stage"];
export type LeadActivityType = Database["public"]["Enums"]["lead_activity_type"];

export type LeadDto = {
  id: string;
  leadNumber: string;
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
  salesperson: string;
  score: number;
  temperature: LeadTemperature;
  stage: LeadStage;
  notes: string;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadActivityDto = {
  id: string;
  type: LeadActivityType;
  description: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  actorName: string;
};

export type LeadMemberOption = {
  id: string;
  name: string;
  role: Database["public"]["Enums"]["member_role"];
};

export type LeadListQuery = {
  search?: string;
  temperature?: LeadTemperature;
  source?: string;
  assignedMemberId?: string;
  stage?: LeadStage;
  sort?: "score" | "date" | "budget";
  page: number;
  pageSize: number;
};

export type LeadListResult = {
  leads: LeadDto[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type LeadMetrics = {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  converted: number;
  conversionRate: number;
  activePipeline: number;
};

export const temperatureLabels: Record<LeadTemperature, "Hot" | "Warm" | "Cold"> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export const stageLabels: Record<LeadStage, string> = {
  new_inquiry: "New Inquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  site_visit: "Site Visit",
  converted: "Converted",
  lost: "Lost",
};
