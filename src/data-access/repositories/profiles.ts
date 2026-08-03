import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";

export const profileColumns = "id,full_name,phone,avatar_url,timezone,updated_at" as const;

export function getProfile(client: AppSupabaseClient, profileId: string) {
  return client.from("profiles").select(profileColumns).eq("id", profileId).maybeSingle();
}
