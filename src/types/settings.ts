import type { AuthContext } from "@/lib/auth";
import type { Database, Json } from "@/types/database";
import type { AICompanySettings } from "@/types/ai";

export const supportedTimezones = [
  "Asia/Karachi", "UTC", "Asia/Dubai", "Asia/Riyadh",
  "Europe/London", "America/New_York", "America/Los_Angeles",
] as const;

export const notificationCategories = [
  "new_lead_assigned", "lead_reassigned", "follow_up_due",
  "follow_up_overdue", "appointment_created", "appointment_rescheduled",
  "appointment_cancelled", "lead_converted", "membership_event",
] as const;

export type NotificationCategory = typeof notificationCategories[number];
export type NotificationPreferences = Partial<Record<NotificationCategory, boolean>>;

export type ScoringRules = {
  version: 1;
  weights: {
    budget: number;
    timeline: number;
    source: number;
    completeness: number;
    service: number;
  };
  budget_thresholds: { warm_pkr: number; hot_pkr: number };
  high_intent_services: string[];
};

export type CompanySettingsDto = {
  companyId: string;
  name: string;
  businessEmail: string;
  phone: string;
  city: string;
  address: string;
  timezone: string;
  currency: string;
  services: string[];
  disabledServices: string[];
  leadSources: string[];
  disabledLeadSources: string[];
  scoringRules: ScoringRules;
  notificationDefaults: NotificationPreferences;
  aiSettings: AICompanySettings;
  companyUpdatedAt: string;
  settingsUpdatedAt: string;
};

export type ProfileDto = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  timezone: string;
  avatarUrl: string | null;
  updatedAt: string;
};

export type SettingsPageData = {
  auth: AuthContext;
  company: CompanySettingsDto;
  profile: ProfileDto;
  preferences: NotificationPreferences;
};

export type SettingsActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationDto = {
  id: string;
  type: Database["public"]["Enums"]["notification_type"];
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  href: string | null;
  payload: Json;
};

export type NotificationCenterData = {
  notifications: NotificationDto[];
  unreadCount: number;
};
