"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import toast from "react-hot-toast";
import type { DashboardData, ViolationItem } from "@/lib/assessment-types";
import {
  EmptyState,
  InputField,
  Panel,
  SectionHeading,
  SelectField,
} from "@/components/assessment-ui";

export function ViolationsPage({ initialData }: { initialData: DashboardData }) {
  const [historyFilters, setHistoryFilters] = useState({
    vehicle_id: "",
    geofence_id: "",
    start_date: "",
    end_date: "",
    limit: "50",
  });
  const [violations, setViolations] = useState<ViolationItem[]>(initialData.violations);
  const [historyCount, setHistoryCount] = useState(initialData.violationCount);

  async function loadViolations() {
    try {
      const searchParams = new URLSearchParams();

      if (historyFilters.vehicle_id) {
        searchParams.set("vehicle_id", historyFilters.vehicle_id);
      }

      if (historyFilters.geofence_id) {
        searchParams.set("geofence_id", historyFilters.geofence_id);
      }

      if (historyFilters.start_date) {
        searchParams.set("start_date", toIsoDate(historyFilters.start_date));
      }

      if (historyFilters.end_date) {
        searchParams.set("end_date", toIsoDate(historyFilters.end_date));
      }

      searchParams.set("limit", historyFilters.limit || "50");

      const response = await fetch(`/violations/history?${searchParams.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to fetch violations");
      }

      setViolations(result.violations);
      setHistoryCount(result.total_count);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to fetch violations");
    }
  }

  return (
    <div className="grid gap-6">
      <Panel>
        <SectionHeading title="Violation history filters" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SelectField
            label="Vehicle"
            value={historyFilters.vehicle_id}
            onChange={(value) => setHistoryFilters((current) => ({ ...current, vehicle_id: value }))}
            options={[
              { label: "All vehicles", value: "" },
              ...initialData.vehicles.map((vehicle) => ({
                label: vehicle.vehicle_number,
                value: vehicle.id,
              })),
            ]}
          />
          <SelectField
            label="Geofence"
            value={historyFilters.geofence_id}
            onChange={(value) => setHistoryFilters((current) => ({ ...current, geofence_id: value }))}
            options={[
              { label: "All geofences", value: "" },
              ...initialData.geofences.map((geofence) => ({
                label: geofence.name,
                value: geofence.id,
              })),
            ]}
          />
          <InputField
            label="Limit"
            value={historyFilters.limit}
            onChange={(value) => setHistoryFilters((current) => ({ ...current, limit: value }))}
            placeholder="50"
          />
          <InputField
            label="Start date"
            type="datetime-local"
            value={historyFilters.start_date}
            onChange={(value) => setHistoryFilters((current) => ({ ...current, start_date: value }))}
            placeholder=""
          />
          <InputField
            label="End date"
            type="datetime-local"
            value={historyFilters.end_date}
            onChange={(value) => setHistoryFilters((current) => ({ ...current, end_date: value }))}
            placeholder=""
          />
        </div>
        <button
          type="button"
          onClick={() => void loadViolations()}
          className="mt-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Refresh violation history
        </button>
        <p className="mt-4 text-sm text-white/50">Total matching events: {historyCount}</p>
      </Panel>

      <Panel className="bg-[#09110a]">
        <SectionHeading title="Violation events" />
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {violations.length === 0 ? (
            <EmptyState
              title="No violations found"
              description="Post some vehicle movement and then refresh the filtered history."
            />
          ) : (
            violations.map((violation) => (
              <div key={violation.id} className="rounded-3xl border border-white/8 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]",
                      violation.event_type === "entry"
                        ? "bg-[#aeff9d24] text-[#d9ff7a]"
                        : "bg-[#ffd1a324] text-[#ffcb8a]",
                    )}
                  >
                    {violation.event_type}
                  </span>
                  <span className="text-sm text-white/45">
                    {formatDistanceToNow(new Date(violation.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-3 text-base text-white">
                  {violation.vehicle_number} · {violation.geofence_name}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  {violation.latitude.toFixed(5)}, {violation.longitude.toFixed(5)}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function toIsoDate(value: string) {
  return new Date(value).toISOString();
}
