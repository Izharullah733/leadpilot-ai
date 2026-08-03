import { TeamClient } from "@/app/(app)/team/team-client";
import { getTeamAdministration } from "@/services/membership-service";
import { getLeadReport } from "@/data-access/services/lead-report-service";
import { getTeamWorkflowMetrics } from "@/data-access/services/follow-up-service";

export default async function TeamPage() {
  const [data, report, workflowMetrics] = await Promise.all([
    getTeamAdministration(),
    getLeadReport(),
    getTeamWorkflowMetrics(),
  ]);
  return <TeamClient {...data} leadPerformance={report.performance} leadMetrics={report.metrics} workflowMetrics={workflowMetrics} />;
}
