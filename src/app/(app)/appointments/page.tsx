import { AppointmentsClient } from "@/app/(app)/appointments/appointments-client";
import { getAppointmentData } from "@/data-access/services/appointment-service";

export default async function AppointmentsPage() {
  const data = await getAppointmentData();
  return <AppointmentsClient
    auth={data.auth}
    appointments={data.appointments}
    members={data.members}
    leads={data.leads}
    timeZone={data.timeZone}
  />;
}
