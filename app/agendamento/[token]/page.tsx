import { AppointmentManagement } from "@/components/appointment-management";

export default async function AppointmentManagementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AppointmentManagement token={token} />;
}
