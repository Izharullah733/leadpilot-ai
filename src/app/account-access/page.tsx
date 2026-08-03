import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { resolveTenantContext } from "@/services/tenant-service";

export const dynamic = "force-dynamic";

export default async function AccountAccessPage() {
  const resolution = await resolveTenantContext();
  if (resolution.state === "anonymous") redirect("/login");
  if (resolution.state === "active") redirect("/dashboard");

  if (resolution.state === "suspended") {
    return (
      <AccessDenied
        title="Membership suspended"
        description="Your company membership is suspended. Contact your company owner or administrator to restore access."
        email={resolution.email}
      />
    );
  }

  if (resolution.state === "no-membership") {
    return (
      <AccessDenied
        title="No active company membership"
        description="Your account is authenticated, but it is not linked to an active company membership."
        email={resolution.email}
      />
    );
  }

  return (
    <AccessDenied
      title="Account setup is incomplete"
      description="Your authenticated account does not have a usable LeadPilot profile. Contact your company administrator."
      email={resolution.email}
    />
  );
}
