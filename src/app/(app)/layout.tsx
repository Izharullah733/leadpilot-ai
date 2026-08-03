import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { AppShell } from "@/components/app-shell";
import { resolveTenantContext } from "@/services/tenant-service";
import { getNotificationCenter } from "@/data-access/services/notification-service";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveTenantContext();
  if (resolution.state === "anonymous") {
    redirect("/login");
  }
  if (resolution.state === "incomplete") {
    return (
      <AccessDenied
        title="Account setup is incomplete"
        description="Your authenticated account does not have a usable LeadPilot profile. Contact your company administrator."
        email={resolution.email}
      />
    );
  }

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

  const notificationCenter = await getNotificationCenter(resolution.auth);
  return <AppShell auth={resolution.auth} notificationCenter={notificationCenter}>{children}</AppShell>;
}
