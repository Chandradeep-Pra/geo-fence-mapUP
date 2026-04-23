import { GeofencesPage } from "@/components/geofences-page";
import { DashboardShell } from "@/components/assessment-ui";
import { getDashboardData } from "@/lib/assessment-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardGeofences() {
  const data = await getDashboardData();

  return (
    <DashboardShell
      activeTab="/dashboard/geofences"
      title="Geofence Management"
      description="Create, inspect, and visualize polygon zones in a page dedicated to boundary setup."
    >
      <GeofencesPage initialData={data} />
    </DashboardShell>
  );
}
