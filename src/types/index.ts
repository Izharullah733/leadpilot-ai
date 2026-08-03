export type LeadStatus = "Hot" | "Warm" | "Cold";
export type PipelineStage =
  | "New Inquiry"
  | "Contacted"
  | "Qualified"
  | "Proposal Sent"
  | "Negotiation"
  | "Site Visit"
  | "Converted";

export interface Lead {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  service: string;
  location: string;
  propertySize: string;
  budget: number;
  timeline: string;
  source: string;
  salesperson: string;
  score: number;
  status: LeadStatus;
  stage: PipelineStage;
  nextFollowUp: string;
  createdAt: string;
  notes: string;
}

export type NewLead = Omit<
  Lead,
  "id" | "score" | "status" | "stage" | "nextFollowUp" | "createdAt"
>;

export interface TeamMember {
  name: string;
  initials: string;
  role: string;
  email: string;
}

export interface Appointment {
  id: number;
  type: "Site Visit" | "Consultation";
  customer: string;
  location: string;
  date: string;
  salesperson: string;
  status: "Confirmed" | "Pending";
}
