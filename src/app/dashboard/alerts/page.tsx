import { AlertsPage } from "@/components/alerts-page";
import { DashboardShell } from "@/components/assessment-ui";
import { getDashboardData } from "@/lib/assessment-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardAlerts() {
  const data = await getDashboardData();

  return (
    <DashboardShell
      activeTab="/dashboard/alerts"
      title="Alert Rules And Live Feed"
      description="Configure monitoring rules and watch real-time alert traffic without mixing it with unrelated forms."
    >
      <AlertsPage initialData={data} />
    </DashboardShell>
  );
}
