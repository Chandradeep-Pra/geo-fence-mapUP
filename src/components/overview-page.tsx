"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardData, LiveAlert } from "@/lib/assessment-types";
import { EmptyState, Panel, SectionHeading, StatCard, categoryTone, formatCategory } from "@/components/assessment-ui";

export function OverviewPage({ initialData }: { initialData: DashboardData }) {
  const [liveAlerts, setLiveAlerts] = useState(initialData.liveAlerts);

  useEffect(() => {
    const eventSource = new EventSource("/ws/alerts");

    eventSource.addEventListener("alert", (event) => {
      const nextAlert = JSON.parse((event as MessageEvent).data) as LiveAlert;
      setLiveAlerts((current) => [nextAlert, ...current].slice(0, 20));
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Geofences" value={String(initialData.geofences.length)} accent="mint" />
        <StatCard label="Vehicles" value={String(initialData.vehicles.length)} accent="gold" />
        <StatCard label="Alert rules" value={String(initialData.alertConfigs.length)} accent="slate" />
        <StatCard label="Violation events" value={String(initialData.violationCount)} accent="mint" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="bg-[#0b130d]">
          <SectionHeading title="Quick actions" />
          <div className="mt-6 grid gap-3">
            <QuickLink
              href="/dashboard/geofences"
              title="Create and inspect geofences"
              description="Manage polygon zones without scrolling through unrelated sections."
            />
            <QuickLink
              href="/dashboard/vehicles"
              title="Register vehicles and post locations"
              description="Keep map interactions and movement simulation in one focused workspace."
            />
            <QuickLink
              href="/dashboard/alerts"
              title="Configure alert rules and watch live feed"
              description="Separate rule setup from raw history so live testing is easier."
            />
            <QuickLink
              href="/dashboard/violations"
              title="Review historical entry and exit events"
              description="Filter and inspect persisted movement events in a dedicated page."
            />
          </div>
        </Panel>

        <Panel className="bg-[#09110a]">
          <SectionHeading title="Recent live alerts" />
          <div className="mt-5 space-y-3">
            {liveAlerts.length === 0 ? (
              <EmptyState
                title="No live alerts yet"
                description="Trigger an entry or exit event to see real-time activity here."
              />
            ) : (
              liveAlerts.slice(0, 6).map((alert) => (
                <div key={alert.event_id} className="rounded-3xl border border-white/8 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                        alert.event_type === "entry"
                          ? "bg-[#aeff9d24] text-[#d9ff7a]"
                          : "bg-[#ffd1a324] text-[#ffcb8a]"
                      }`}
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
                  <p className="mt-2 text-sm text-white/60">
                    {alert.vehicle.driver_name} · {formatCategory(alert.geofence.category)} ·{" "}
                    {alert.location.latitude.toFixed(5)}, {alert.location.longitude.toFixed(5)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <SectionHeading title="Latest geofences" />
          <div className="mt-5 space-y-3">
            {initialData.geofences.length === 0 ? (
              <EmptyState
                title="No geofences yet"
                description="Create your first polygon zone from the geofences page."
              />
            ) : (
              initialData.geofences.slice(0, 4).map((geofence) => (
                <div key={geofence.id} className="rounded-3xl border border-white/8 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-medium text-white">{geofence.name}</p>
                      <p className="mt-1 text-sm text-white/60">
                        {geofence.description || "Assessment polygon geofence."}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${categoryTone(geofence.category)}`}>
                      {formatCategory(geofence.category)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="bg-[#09110a]">
          <SectionHeading title="Latest vehicles" />
          <div className="mt-5 space-y-3">
            {initialData.vehicles.length === 0 ? (
              <EmptyState
                title="No vehicles yet"
                description="Register a vehicle from the vehicles page to start movement testing."
              />
            ) : (
              initialData.vehicles.slice(0, 4).map((vehicle) => (
                <div key={vehicle.id} className="rounded-3xl border border-white/8 bg-white/5 p-5">
                  <p className="text-lg font-medium text-white">{vehicle.vehicle_number}</p>
                  <p className="mt-1 text-sm text-white/60">
                    {vehicle.driver_name} · {vehicle.vehicle_type}
                  </p>
                  <p className="mt-3 text-sm text-white/55">
                    {vehicle.current_location
                      ? `Last location ${vehicle.current_location.latitude.toFixed(5)}, ${vehicle.current_location.longitude.toFixed(5)}`
                      : "No location posted yet"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:bg-white/8"
    >
      <p className="text-lg font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
    </Link>
  );
}
