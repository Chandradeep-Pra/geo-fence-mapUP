import { OverviewPage } from "@/components/overview-page";
import { DashboardShell } from "@/components/assessment-ui";
import { getDashboardData } from "@/lib/assessment-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const data = await getDashboardData();

  return (
    <DashboardShell
      activeTab="/dashboard"
      title="Overview"
      description="Use focused tabs to test each flow without wading through one oversized screen."
    >
      <OverviewPage initialData={data} />
    </DashboardShell>
  );
}
