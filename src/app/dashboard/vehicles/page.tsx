import { DashboardShell } from "@/components/assessment-ui";
import { VehiclesPage } from "@/components/vehicles-page";
import { getDashboardData } from "@/lib/assessment-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardVehicles() {
  const data = await getDashboardData();

  return (
    <DashboardShell
      activeTab="/dashboard/vehicles"
      title="Vehicle Tracking"
      description="Register vehicles, post live or manual positions, and run movement simulations from one focused workspace."
    >
      <VehiclesPage initialData={data} />
    </DashboardShell>
  );
}
