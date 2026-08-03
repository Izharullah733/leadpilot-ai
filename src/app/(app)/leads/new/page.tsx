import { randomUUID } from "node:crypto";
import { NewLeadForm } from "@/app/(app)/leads/new/new-lead-form";
import { getLeadFormOptions } from "@/data-access/services/lead-service";

export default async function NewLeadPage() {
  const { auth, members, services, sources } = await getLeadFormOptions();
  return <NewLeadForm auth={auth} members={members} services={services} sources={sources} requestId={randomUUID()} />;
}
