import { FollowUpsClient } from "@/app/(app)/follow-ups/follow-ups-client";
import { getFollowUpData } from "@/data-access/services/follow-up-service";

export default async function FollowUpsPage() {
  const data = await getFollowUpData();
  return <FollowUpsClient
    auth={data.auth}
    members={data.members}
    leads={data.leads}
    groups={data.groups}
    timeZone={data.timeZone}
  />;
}
