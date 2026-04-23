"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { DashboardData } from "@/lib/assessment-types";
import { useLiveAlerts } from "@/hooks/use-live-alerts";
import {
  EmptyState,
  Panel,
  PrimaryButton,
  SectionHeading,
  SelectField,
  categoryTone,
  formatCategory,
} from "@/components/assessment-ui";

export function AlertsPage({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [alertConfig, setAlertConfig] = useState({
    geofence_id: initialData.geofences[0]?.id ?? "",
    vehicle_id: "",
    event_type: "both" as "entry" | "exit" | "both",
  });
  const liveAlerts = useLiveAlerts(initialData.liveAlerts, {
    onNewAlert: (nextAlert) => {
      toast.success(
        `${nextAlert.vehicle.vehicle_number} ${nextAlert.event_type} ${nextAlert.geofence.geofence_name}`,
      );
      startTransition(() => {
        router.refresh();
      });
    },
  });

  async function refreshPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleAlertConfigSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!alertConfig.geofence_id) {
      toast.error("Choose a geofence.");
      return;
    }

    try {
      const response = await fetch("/alerts/configure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          geofence_id: alertConfig.geofence_id,
          vehicle_id: alertConfig.vehicle_id || undefined,
          event_type: alertConfig.event_type,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to configure alert");
      }

      toast.success(`Alert rule created (${result.time_ns}ns)`);
      await refreshPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to configure alert");
    }
  }

  async function updateAlertStatus(alertId: string, status: "active" | "inactive") {
    try {
      const response = await fetch(`/alerts/${alertId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update alert");
      }

      toast.success(`Alert ${status === "active" ? "enabled" : "disabled"} (${result.time_ns}ns)`);
      await refreshPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update alert");
    }
  }

  async function deleteAlert(alertId: string) {
    try {
      const response = await fetch(`/alerts/${alertId}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete alert");
      }

      toast.success(`Alert deleted (${result.time_ns}ns)`);
      await refreshPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete alert");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-6">
        <Panel>
          <SectionHeading title="Configure alert rule" />
          <form onSubmit={handleAlertConfigSubmit} className="mt-6 grid gap-4">
            <SelectField
              label="Geofence"
              value={alertConfig.geofence_id}
              onChange={(value) => setAlertConfig((current) => ({ ...current, geofence_id: value }))}
              options={initialData.geofences.map((geofence) => ({
                label: geofence.name,
                value: geofence.id,
              }))}
            />
            <SelectField
              label="Vehicle"
              value={alertConfig.vehicle_id}
              onChange={(value) => setAlertConfig((current) => ({ ...current, vehicle_id: value }))}
              options={[
                { label: "All vehicles", value: "" },
                ...initialData.vehicles.map((vehicle) => ({
                  label: vehicle.vehicle_number,
                  value: vehicle.id,
                })),
              ]}
            />
            <SelectField
              label="Event type"
              value={alertConfig.event_type}
              onChange={(value) =>
                setAlertConfig((current) => ({
                  ...current,
                  event_type: value as "entry" | "exit" | "both",
                }))
              }
              options={[
                { label: "Entry and exit", value: "both" },
                { label: "Entry", value: "entry" },
                { label: "Exit", value: "exit" },
              ]}
            />
            <PrimaryButton disabled={isPending} className="mt-2 w-full">
              Save alert rule
            </PrimaryButton>
          </form>
        </Panel>

        <Panel className="bg-[#09110a]">
          <SectionHeading title="Configured rules" />
          <div className="mt-5 space-y-3">
            {initialData.alertConfigs.length === 0 ? (
              <EmptyState
                title="No alert rules yet"
                description="Create a rule to monitor entry, exit, or both for a geofence."
              />
            ) : (
              initialData.alertConfigs.map((alertConfigItem) => (
                <div key={alertConfigItem.alert_id} className="rounded-3xl border border-white/8 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-medium text-white">{alertConfigItem.geofence_name}</p>
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]",
                          alertConfigItem.status === "active"
                            ? "bg-[#aeff9d1c] text-[#d9ff7a]"
                            : "bg-white/10 text-white/55",
                        )}
                      >
                        {alertConfigItem.event_type}
                      </span>
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]",
                          alertConfigItem.status === "active"
                            ? "bg-[#7dd3fc24] text-[#7dd3fc]"
                            : "bg-[#ffd1a324] text-[#ffcb8a]",
                        )}
                      >
                        {alertConfigItem.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    {alertConfigItem.vehicle_number
                      ? `Applies to ${alertConfigItem.vehicle_number}`
                      : "Applies to all vehicles"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void updateAlertStatus(
                          alertConfigItem.alert_id,
                          alertConfigItem.status === "active" ? "inactive" : "active",
                        )
                      }
                      className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/10"
                    >
                      {alertConfigItem.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteAlert(alertConfigItem.alert_id)}
                      className="rounded-full border border-[#ff8b7d40] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#ffb0a6] transition hover:bg-[#ff8b7d12]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel className="bg-[#0b130d]">
        <SectionHeading title="Live alert feed" />
        <div className="mt-5 space-y-3">
          {liveAlerts.length === 0 ? (
            <EmptyState
              title="No live alerts yet"
              description="Post a vehicle location that enters or exits a monitored zone to see events here."
            />
          ) : (
            liveAlerts.map((alert) => (
              <div key={alert.event_id} className="rounded-3xl border border-white/8 bg-black/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]",
                      alert.event_type === "entry"
                        ? "bg-[#aeff9d24] text-[#d9ff7a]"
                        : "bg-[#ffd1a324] text-[#ffcb8a]",
                    )}
                  >
                    {alert.event_type}
                  </span>
                  <span className="text-sm text-white/45">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-4 text-base text-white">
                  <span className="font-medium">{alert.vehicle.vehicle_number}</span> triggered an{" "}
                  {alert.event_type} event for <span className="font-medium">{alert.geofence.geofence_name}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${categoryTone(alert.geofence.category)}`}>
                    {formatCategory(alert.geofence.category)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  {alert.vehicle.driver_name} · {alert.location.latitude.toFixed(5)},{" "}
                  {alert.location.longitude.toFixed(5)}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
