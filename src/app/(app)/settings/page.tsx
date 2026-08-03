import { SettingsClient } from "@/app/(app)/settings/settings-client";
import { getSettingsPageData } from "@/data-access/services/settings-service";

export default async function SettingsPage() {
  const data = await getSettingsPageData();
  return <SettingsClient key={data.auth.companyId} data={data} />;
}
