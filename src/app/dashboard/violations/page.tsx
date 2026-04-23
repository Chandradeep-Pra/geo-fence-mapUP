import { DashboardShell } from "@/components/assessment-ui";
import { ViolationsPage } from "@/components/violations-page";
import { getDashboardData } from "@/lib/assessment-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardViolations() {
  const data = await getDashboardData();

  return (
    <DashboardShell
      activeTab="/dashboard/violations"
      title="Violation History"
      description="Review stored entry and exit events on a dedicated page built for filtering and inspection."
    >
      <ViolationsPage initialData={data} />
    </DashboardShell>
  );
}
